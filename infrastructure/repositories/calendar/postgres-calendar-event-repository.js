const {
  toDatabaseStatus,
  fromDatabaseStatus,
} = require("../reservation-request/postgres-request-status");
const { CalendarEvent } = require("../../../domain/entities/calendar/calendar-event");
const {
  ReservationRequestStatus,
  ActiveReservationRequestStatuses,
  CalendarEventStatuses,
  ResourceBlockingEventStatuses,
} = require("../../../domain/enums/reservation-request/request-status");
const { CalendarSyncStatus } = require("../../../domain/enums/calendar/calendar-sync-status");
const { CalendarSyncOperation } = require("../../../domain/enums/calendar/calendar-sync-operation");
const { CalendarRules } = require("../../../domain/constants/calendar-rules");
const UserRole = require("../../../domain/enums/auth/user-role");
const UserStatus = require("../../../domain/enums/auth/user-status");
const { resourceBlockEnd } = require("../../../application/services/calendar/availability-rules");

const EVENT_SELECT = `SELECT e.id AS id_event, e.id_request, r.folio, e.title, e.start_at, e.end_at,
       e.location, r.logistic_user_id, u.full_name AS logistic_user_name, r.status,
       e.sync_status, e.google_event_id, e.created_at, e.updated_at
  FROM calendar_events e
  JOIN reservations_request r ON r.id = e.id_request
  LEFT JOIN users u ON u.id_user = r.logistic_user_id`;

const accept = (result) => ({ commit: true, result });
const reject = (result) => ({ commit: false, result });

function peakResourceUsage(overlapping, startAt, endAt) {
  // Recortar cada bloqueo a la ventana candidata y calcular el pico simultáneo.
  // En extremos iguales se libera antes de ocupar: los intervalos son [inicio, fin).
  const windowStart = new Date(startAt).getTime();
  const windowEnd = resourceBlockEnd(endAt).getTime();
  const changes = overlapping.flatMap((row) => [
    {
      time: Math.max(windowStart, new Date(row.start_at).getTime()),
      quantity: Number(row.quantity),
    },
    {
      time: Math.min(windowEnd, resourceBlockEnd(new Date(row.end_at)).getTime()),
      quantity: -Number(row.quantity),
    },
  ]);
  changes.sort((a, b) => a.time - b.time || a.quantity - b.quantity);
  const { peak: used } = changes.reduce(
    ({ current, peak }, change) => {
      const next = current + change.quantity;
      return { current: next, peak: Math.max(peak, next) };
    },
    { current: 0, peak: 0 }
  );
  return used;
}

// Función 3.3 - Persistencia del calendario interno en PostgreSQL.
//
// Concurrencia: toda operación que asigna horario bloquea (SELECT ... FOR UPDATE), siempre
// en el mismo orden, 1) la fila de la solicitud, 2) la fila del responsable y 3) las filas de
// los recursos ordenadas por id. Así dos transacciones que compiten por el mismo responsable o
// recurso se serializan y la segunda ve el bloqueo de la primera (sin interbloqueos entre ellas).
class PostgresCalendarEventRepository {
  constructor(pool) {
    this.pool = pool;
  }

  async schedule({ requestId, title, now }) {
    return this.runInTransaction(async (connection) => {
      const request = await this.lockRequest(connection, requestId);

      if (!request) {
        return reject({ status: "not_found" });
      }

      if (fromDatabaseStatus(request.status) !== ReservationRequestStatus.PROPOSAL_GENERATED) {
        return reject({ status: "not_schedulable" });
      }

      const agreements = await connection.query(
        `SELECT d.start_datetime, d.end_datetime, d.location
         FROM proposals p JOIN derived_information d ON d.id = p.derived_information_id
         WHERE p.request_id = $1 AND d.request_id = $1`,
        [requestId]
      );
      if (!agreements.rows[0]) return reject({ status: "not_schedulable" });
      const agreed = agreements.rows[0];
      const startAt = new Date(agreed.start_datetime);
      const endAt = new Date(agreed.end_datetime);
      const conflicts = await this.findConflicts(connection, {
        requestId,
        logisticUserId: request.logistic_user_id,
        startAt,
        endAt,
      });

      if (conflicts.length > 0) {
        return reject({ status: "unavailable", conflicts });
      }

      const inserted = await connection.query(
        `INSERT INTO calendar_events
           (id_request, title, start_at, end_at, location, sync_status, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $7)
         RETURNING id AS id_event`,
        [requestId, title.slice(0, 200), startAt, endAt, agreed.location, "PENDING", now]
      );
      const eventId = Number(inserted.rows[0].id_event);

      await connection.query("UPDATE reservations_request SET status = $1 WHERE id = $2", [
        toDatabaseStatus(ReservationRequestStatus.CONFIRMED),
        requestId,
      ]);
      await connection.query(
        `UPDATE reservations_request SET
         event_date = ($2::timestamptz AT TIME ZONE 'America/Merida')::date,
         event_time = ($2::timestamptz AT TIME ZONE 'America/Merida')::time,
         event_end_time = $3, event_address = $4 WHERE id = $1`,
        [requestId, startAt, endAt, agreed.location]
      );
      await connection.query(
        "UPDATE proposals SET status = 'ACCEPTED', updated_at = $2 WHERE request_id = $1",
        [requestId, now]
      );
      await this.enqueue(connection, eventId, CalendarSyncOperation.CREATE, now);

      return accept({ status: "scheduled", event: await this.fetchEvent(connection, eventId) });
    });
  }

  // Incremento 3 (RF-3.4.4.4.3): se invoca dentro de la transacción de aceptación. Crea el
  // evento y encola la sincronización, y revalida disponibilidad sin contar la propia
  // solicitud; NO cambia el estado de la solicitud ni de la propuesta (lo hace el caso de uso).
  // connection es la conexión de la transacción del accept.
  async scheduleForAcceptance({ requestId, title, now, connection }) {
    const request = await this.lockRequest(connection, requestId);

    if (!request) {
      return { status: "not_found" };
    }

    const agreements = await connection.query(
      `SELECT d.start_datetime, d.end_datetime, d.location
       FROM proposals p JOIN derived_information d ON d.id = p.derived_information_id
       WHERE p.request_id = $1 AND d.request_id = $1
       ORDER BY p.version DESC NULLS LAST, p.id DESC
       LIMIT 1`,
      [requestId]
    );

    if (!agreements.rows[0]) {
      return { status: "not_found" };
    }

    const agreed = agreements.rows[0];
    const startAt = new Date(agreed.start_datetime);
    const endAt = new Date(agreed.end_datetime);
    const conflicts = await this.findConflicts(connection, {
      requestId,
      logisticUserId: request.logistic_user_id,
      startAt,
      endAt,
    });

    if (conflicts.length > 0) {
      return { status: "unavailable", conflicts };
    }

    const inserted = await connection.query(
      `INSERT INTO calendar_events
         (id_request, title, start_at, end_at, location, sync_status, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $7)
       RETURNING id AS id_event`,
      [requestId, title.slice(0, 200), startAt, endAt, agreed.location, "PENDING", now]
    );
    const eventId = Number(inserted.rows[0].id_event);

    await this.enqueue(connection, eventId, CalendarSyncOperation.CREATE, now);

    return { status: "scheduled", event: await this.fetchEvent(connection, eventId) };
  }

  async reschedule({ eventId, startAt, endAt, location, now }) {
    return this.runInTransaction(async (connection) => {
      const locked = await this.lockEventAndRequest(connection, eventId);

      if (!locked) {
        return reject({ status: "not_found" });
      }

      const { request, event } = locked;

      if (fromDatabaseStatus(request.status) !== ReservationRequestStatus.CONFIRMED) {
        return reject({ status: "not_editable" });
      }

      if (new Date(event.start_at).getTime() <= now.getTime()) {
        return reject({ status: "already_started" });
      }

      const scheduleChanged =
        new Date(event.start_at).getTime() !== startAt.getTime() ||
        new Date(event.end_at).getTime() !== endAt.getTime();

      if (scheduleChanged) {
        const conflicts = await this.findConflicts(connection, {
          requestId: Number(request.id_reservation_request),
          logisticUserId: request.logistic_user_id,
          startAt,
          endAt,
        });

        if (conflicts.length > 0) {
          return reject({ status: "unavailable", conflicts });
        }
      }

      if (!scheduleChanged && event.location === location) {
        return accept({ status: "rescheduled", event: await this.fetchEvent(connection, eventId) });
      }

      await connection.query(
        `UPDATE calendar_events
         SET start_at = $2, end_at = $3, location = $4, sync_status = $5, updated_at = $6
         WHERE id = $1`,
        [eventId, startAt, endAt, location, "PENDING", now]
      );
      await connection.query(
        `UPDATE reservations_request
         SET event_date = ($2::timestamptz AT TIME ZONE 'America/Merida')::date, event_time = ($2::timestamptz AT TIME ZONE 'America/Merida')::time, event_end_time = $3, event_address = $4
         WHERE id = $1`,
        [request.id_reservation_request, startAt, endAt, location]
      );
      await this.enqueue(connection, eventId, CalendarSyncOperation.UPDATE, now);

      return accept({ status: "rescheduled", event: await this.fetchEvent(connection, eventId) });
    });
  }

  async cancel({ eventId, now }) {
    return this.runInTransaction(async (connection) => {
      const locked = await this.lockEventAndRequest(connection, eventId);

      if (!locked) {
        return reject({ status: "not_found" });
      }

      const { request, event } = locked;
      const hasFinished = new Date(event.end_at).getTime() <= now.getTime();

      // Un evento cuya hora de fin ya pasó es «Finalizado» aunque el proceso periódico
      // todavía no lo haya actualizado.
      if (
        fromDatabaseStatus(request.status) !== ReservationRequestStatus.CONFIRMED ||
        hasFinished
      ) {
        return reject({ status: "not_cancellable" });
      }

      await connection.query("UPDATE reservations_request SET status = $1 WHERE id = $2", [
        toDatabaseStatus(ReservationRequestStatus.CANCELLED),
        request.id_reservation_request,
      ]);
      // D.5 / D.6: libera de inmediato los recursos (y con ellos el bloqueo de tres horas).
      await connection.query(
        `UPDATE assigned_resources
         SET status = 'RELEASED', released_at = $2, updated_at = $2
         WHERE request_id = $1 AND status <> 'RELEASED'`,
        [request.id_reservation_request, now]
      );
      await connection.query(
        "UPDATE calendar_events SET sync_status = $2, updated_at = $3 WHERE id = $1",
        [eventId, "PENDING", now]
      );
      await this.enqueue(connection, eventId, CalendarSyncOperation.DELETE, now);

      return accept({ status: "cancelled", event: await this.fetchEvent(connection, eventId) });
    });
  }

  async findById(id) {
    const result = await this.pool.query(`${EVENT_SELECT} WHERE e.id = $1`, [id]);

    return result.rows[0] ? this.toEntity(result.rows[0]) : null;
  }

  async findAll(filters, page, perPage) {
    const statuses = filters.includeCancelled
      ? CalendarEventStatuses
      : CalendarEventStatuses.filter((status) => status !== ReservationRequestStatus.CANCELLED);
    const parameters = [statuses.map(toDatabaseStatus)];
    const conditions = ["r.status = ANY($1)"];

    if (filters.logisticUserId !== undefined) {
      parameters.push(filters.logisticUserId);
      conditions.push(`r.logistic_user_id = $${parameters.length}`);
    }

    // El evento se muestra en todos los días que ocupa (inicio < fin del día y fin > inicio).
    if (filters.dayStart && filters.dayEnd) {
      parameters.push(filters.dayEnd, filters.dayStart);
      conditions.push(
        `e.start_at < $${parameters.length - 1} AND e.end_at > $${parameters.length}`
      );
    }

    const where = ` WHERE ${conditions.join(" AND ")}`;
    const countResult = await this.pool.query(
      `SELECT COUNT(*)::int AS total_records
       FROM calendar_events e
       JOIN reservations_request r ON r.id = e.id_request${where}`,
      parameters
    );
    const dataParameters = [...parameters, perPage, (page - 1) * perPage];
    const result = await this.pool.query(
      `${EVENT_SELECT}${where}
       ORDER BY e.start_at ASC, e.id ASC
       LIMIT $${dataParameters.length - 1} OFFSET $${dataParameters.length}`,
      dataParameters
    );

    return {
      events: result.rows.map((row) => this.toEntity(row)),
      totalRecords: countResult.rows[0]?.total_records ?? 0,
    };
  }

  // F.3: Confirmado -> Finalizado al transcurrir la hora de fin. SKIP LOCKED evita esperar
  // a operaciones en curso sobre la misma solicitud; se actualizarán en el siguiente ciclo.
  async finalizeElapsed(now) {
    const result = await this.pool.query(
      `UPDATE reservations_request
       SET status = $1
       WHERE id IN (
         SELECT r.id
         FROM reservations_request r
         JOIN calendar_events e ON e.id_request = r.id
         WHERE r.status = $2 AND e.end_at <= $3
         ORDER BY r.id
         FOR UPDATE OF r SKIP LOCKED
       )`,
      [
        toDatabaseStatus(ReservationRequestStatus.FINISHED),
        toDatabaseStatus(ReservationRequestStatus.CONFIRMED),
        now,
      ]
    );

    return result.rowCount;
  }

  async runInTransaction(work) {
    const connection = await this.pool.connect();

    try {
      await connection.query("BEGIN");
      const { commit, result } = await work(connection);
      await connection.query(commit ? "COMMIT" : "ROLLBACK");

      return result;
    } catch (error) {
      await connection.query("ROLLBACK").catch(() => undefined);
      throw error;
    } finally {
      connection.release();
    }
  }

  async lockRequest(connection, requestId) {
    const result = await connection.query(
      `SELECT id AS id_reservation_request, folio, status, event_date_time, event_end_time,
              event_address, logistic_user_id
       FROM reservations_request
       WHERE id = $1
       FOR UPDATE`,
      [requestId]
    );

    return result.rows[0] ?? null;
  }

  // Orden de bloqueo fijo: primero la solicitud y después el evento.
  async lockEventAndRequest(connection, eventId) {
    const owner = await connection.query("SELECT id_request FROM calendar_events WHERE id = $1", [
      eventId,
    ]);

    if (!owner.rows[0]) return null;

    const request = await this.lockRequest(connection, owner.rows[0].id_request);
    const event = await connection.query(
      `SELECT start_at, end_at, location
       FROM calendar_events
       WHERE id = $1
       FOR UPDATE`,
      [eventId]
    );

    return request && event.rows[0] ? { request, event: event.rows[0] } : null;
  }

  async fetchEvent(connection, eventId) {
    const result = await connection.query(`${EVENT_SELECT} WHERE e.id = $1`, [eventId]);

    return this.toEntity(result.rows[0]);
  }

  async enqueue(connection, eventId, operation, now) {
    await connection.query(
      `INSERT INTO calendar_sync_outbox (calendar_event_id, operation, status, next_attempt_at, created_at)
       VALUES ($1, $2, 'PENDING', $3, $3)`,
      [eventId, operation.toUpperCase(), now]
    );
  }

  // Disponibilidad del responsable y de todos los recursos asignados para [startAt, endAt).
  async findConflicts(connection, { requestId, logisticUserId, startAt, endAt }) {
    const responsibleConflicts = await this.findResponsibleConflicts(connection, {
      requestId,
      logisticUserId,
      startAt,
      endAt,
    });
    const resourceConflicts = await this.findResourceConflicts(connection, {
      requestId,
      startAt,
      endAt,
    });

    return [...responsibleConflicts, ...resourceConflicts];
  }

  async findResponsibleConflicts(connection, { requestId, logisticUserId, startAt, endAt }) {
    if (logisticUserId === null || logisticUserId === undefined) {
      return [{ type: "responsible", reason: "unavailable" }];
    }

    const user = await connection.query(
      `SELECT id_user FROM users
       WHERE id_user = $1 AND role = $2 AND status = $3
       FOR UPDATE`,
      [logisticUserId, UserRole.LOGISTICS, UserStatus.ACTIVE.toUpperCase()]
    );

    if (!user.rows[0]) {
      return [{ type: "responsible", reason: "unavailable" }];
    }

    const overlaps = await connection.query(
      `SELECT folio, event_date_time, event_end_time
       FROM reservations_request
       WHERE logistic_user_id = $1
         AND id <> $2
         AND status = ANY($3)
         AND event_date_time < $4
         AND event_end_time > $5`,
      [
        logisticUserId,
        requestId,
        ActiveReservationRequestStatuses.map(toDatabaseStatus),
        endAt,
        startAt,
      ]
    );

    return overlaps.rows.map((row) => ({
      type: "responsible",
      reason: "overlap",
      folio: row.folio,
      startAt: new Date(row.event_date_time),
      endAt: new Date(row.event_end_time),
    }));
  }

  async findResourceConflicts(connection, { requestId, startAt, endAt }) {
    const assigned = await connection.query(
      `SELECT a.resource_id AS id_resource, SUM(a.quantity)::int AS quantity
       FROM proposal_resources a JOIN proposals p ON p.id = a.proposal_id
       WHERE p.request_id = $1
       GROUP BY a.resource_id ORDER BY a.resource_id`,
      [requestId]
    );

    if (assigned.rows.length === 0) {
      return [];
    }

    const resourceIds = assigned.rows.map((row) => Number(row.id_resource));
    const resources = await connection.query(
      `SELECT id, name, total_quantity, is_active
       FROM resources
       WHERE id = ANY($1::bigint[])
       ORDER BY id
       FOR UPDATE`,
      [resourceIds]
    );
    // Ventana que ocupa el nuevo horario: hasta tres horas después de su fin (F.4 / F.5). Un
    // evento ajeno solo bloquea si empieza antes de esa ventana y su propio bloqueo termina
    // después de nuestro inicio; tocarse en el extremo exacto no es traslape.
    const usage = await connection.query(
      `SELECT a.resource_id AS id_resource, a.quantity, r.folio, e.start_at, e.end_at
       FROM proposal_resources a JOIN proposals p ON p.id = a.proposal_id
       JOIN reservations_request r ON r.id = p.request_id
       JOIN calendar_events e ON e.id_request = r.id
       WHERE a.resource_id = ANY($1::bigint[])
         AND r.id <> $2
         AND r.status = ANY($3)
         AND e.start_at < $4
         AND e.end_at + make_interval(mins => $5::int) > $6`,
      [
        resourceIds,
        requestId,
        ResourceBlockingEventStatuses.map(toDatabaseStatus),
        resourceBlockEnd(endAt),
        CalendarRules.POST_EVENT_BLOCK_MINUTES,
        startAt,
      ]
    );
    const resourcesById = new Map(resources.rows.map((row) => [Number(row.id), row]));

    return assigned.rows.flatMap((assignment) => {
      const resourceId = Number(assignment.id_resource);
      const resource = resourcesById.get(resourceId);

      if (!resource || !resource.is_active) {
        return [
          {
            type: "resource",
            reason: resource ? "inactive" : "unavailable",
            resourceId,
            resourceName: resource?.name ?? null,
            folios: [],
          },
        ];
      }

      const overlapping = usage.rows.filter((row) => Number(row.id_resource) === resourceId);
      const used = peakResourceUsage(overlapping, startAt, endAt);

      if (used + assignment.quantity <= resource.total_quantity) {
        return [];
      }

      return [
        {
          type: "resource",
          reason: overlapping.length > 0 ? "overlap" : "insufficient_quantity",
          resourceId,
          resourceName: resource.name,
          folios: [...new Set(overlapping.map((row) => row.folio))],
        },
      ];
    });
  }

  toEntity(row) {
    return new CalendarEvent(
      Number(row.id_event),
      Number(row.id_request),
      row.folio,
      row.title,
      new Date(row.start_at),
      new Date(row.end_at),
      row.location,
      row.logistic_user_id === null ? null : Number(row.logistic_user_id),
      row.logistic_user_name,
      fromDatabaseStatus(row.status),
      row.sync_status === "SYNCED" ? CalendarSyncStatus.SYNCED : CalendarSyncStatus.PENDING,
      row.google_event_id,
      new Date(row.created_at),
      new Date(row.updated_at)
    );
  }
}

module.exports = { PostgresCalendarEventRepository };
