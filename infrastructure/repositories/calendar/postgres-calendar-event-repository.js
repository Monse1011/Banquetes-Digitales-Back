const { CalendarEvent } = require("../../../domain/entities/calendar/calendar-event");
const {
  ReservationRequestStatus,
  ActiveReservationRequestStatuses,
  CalendarEventStatuses,
  ResourceBlockingEventStatuses,
} = require("../../../domain/enums/reservation-request/request-status");
const { CalendarSyncStatus } = require("../../../domain/enums/calendar/calendar-sync-status");
const { CalendarSyncOperation } = require("../../../domain/enums/calendar/calendar-sync-operation");
const {
  ResourceAssignmentStatus,
} = require("../../../domain/enums/calendar/resource-assignment-status");
const { CalendarRules } = require("../../../domain/constants/calendar-rules");
const UserRole = require("../../../domain/enums/auth/user-role");
const UserStatus = require("../../../domain/enums/auth/user-status");
const { resourceBlockEnd } = require("../../../application/services/calendar/availability-rules");

const EVENT_SELECT = `SELECT e.id_event, e.id_request, r.folio, e.title, e.start_at, e.end_at,
       e.location, r.logistic_user_id, u.full_name AS logistic_user_name, r.status,
       e.sync_status, e.google_event_id, e.created_at, e.updated_at
  FROM calendar_events e
  JOIN reservations_request r ON r.id_reservation_request = e.id_request
  LEFT JOIN users u ON u.id_user = r.logistic_user_id`;

const accept = (result) => ({ commit: true, result });
const reject = (result) => ({ commit: false, result });

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

      if (request.status !== ReservationRequestStatus.PROPOSAL_GENERATED) {
        return reject({ status: "not_schedulable" });
      }

      const startAt = new Date(request.event_date_time);
      const endAt = new Date(request.event_end_time);
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
         RETURNING id_event`,
        [
          requestId,
          title.slice(0, 200),
          startAt,
          endAt,
          request.event_address,
          CalendarSyncStatus.PENDING,
          now,
        ]
      );
      const eventId = Number(inserted.rows[0].id_event);

      await connection.query(
        "UPDATE reservations_request SET status = $1 WHERE id_reservation_request = $2",
        [ReservationRequestStatus.CONFIRMED, requestId]
      );
      await this.enqueue(connection, eventId, CalendarSyncOperation.CREATE, now);

      return accept({ status: "scheduled", event: await this.fetchEvent(connection, eventId) });
    });
  }

  async reschedule({ eventId, startAt, endAt, location, now }) {
    return this.runInTransaction(async (connection) => {
      const locked = await this.lockEventAndRequest(connection, eventId);

      if (!locked) {
        return reject({ status: "not_found" });
      }

      const { request, event } = locked;

      if (request.status !== ReservationRequestStatus.CONFIRMED) {
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
         WHERE id_event = $1`,
        [eventId, startAt, endAt, location, CalendarSyncStatus.PENDING, now]
      );
      await connection.query(
        `UPDATE reservations_request
         SET event_date_time = $2, event_end_time = $3, event_address = $4
         WHERE id_reservation_request = $1`,
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
      if (request.status !== ReservationRequestStatus.CONFIRMED || hasFinished) {
        return reject({ status: "not_cancellable" });
      }

      await connection.query(
        "UPDATE reservations_request SET status = $1 WHERE id_reservation_request = $2",
        [ReservationRequestStatus.CANCELLED, request.id_reservation_request]
      );
      // D.5 / D.6: libera de inmediato los recursos (y con ellos el bloqueo de tres horas).
      await connection.query(
        `UPDATE reservation_resource_assignments
         SET status = $2, released_at = $3
         WHERE id_request = $1 AND status = $4`,
        [
          request.id_reservation_request,
          ResourceAssignmentStatus.RELEASED,
          now,
          ResourceAssignmentStatus.ASSIGNED,
        ]
      );
      await connection.query(
        "UPDATE calendar_events SET sync_status = $2, updated_at = $3 WHERE id_event = $1",
        [eventId, CalendarSyncStatus.PENDING, now]
      );
      await this.enqueue(connection, eventId, CalendarSyncOperation.DELETE, now);

      return accept({ status: "cancelled", event: await this.fetchEvent(connection, eventId) });
    });
  }

  async findById(id) {
    const result = await this.pool.query(`${EVENT_SELECT} WHERE e.id_event = $1`, [id]);

    return result.rows[0] ? this.toEntity(result.rows[0]) : null;
  }

  async findAll(filters, page, perPage) {
    const statuses = filters.includeCancelled
      ? CalendarEventStatuses
      : CalendarEventStatuses.filter((status) => status !== ReservationRequestStatus.CANCELLED);
    const parameters = [statuses];
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
       JOIN reservations_request r ON r.id_reservation_request = e.id_request${where}`,
      parameters
    );
    const dataParameters = [...parameters, perPage, (page - 1) * perPage];
    const result = await this.pool.query(
      `${EVENT_SELECT}${where}
       ORDER BY e.start_at ASC, e.id_event ASC
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
       WHERE id_reservation_request IN (
         SELECT r.id_reservation_request
         FROM reservations_request r
         JOIN calendar_events e ON e.id_request = r.id_reservation_request
         WHERE r.status = $2 AND e.end_at <= $3
         ORDER BY r.id_reservation_request
         FOR UPDATE OF r SKIP LOCKED
       )`,
      [ReservationRequestStatus.FINISHED, ReservationRequestStatus.CONFIRMED, now]
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
      `SELECT id_reservation_request, folio, status, event_date_time, event_end_time,
              event_address, logistic_user_id
       FROM reservations_request
       WHERE id_reservation_request = $1
       FOR UPDATE`,
      [requestId]
    );

    return result.rows[0] ?? null;
  }

  // Orden de bloqueo fijo: primero la solicitud y después el evento.
  async lockEventAndRequest(connection, eventId) {
    const owner = await connection.query(
      "SELECT id_request FROM calendar_events WHERE id_event = $1",
      [eventId]
    );

    if (!owner.rows[0]) return null;

    const request = await this.lockRequest(connection, owner.rows[0].id_request);
    const event = await connection.query(
      `SELECT start_at, end_at, location
       FROM calendar_events
       WHERE id_event = $1
       FOR UPDATE`,
      [eventId]
    );

    return request && event.rows[0] ? { request, event: event.rows[0] } : null;
  }

  async fetchEvent(connection, eventId) {
    const result = await connection.query(`${EVENT_SELECT} WHERE e.id_event = $1`, [eventId]);

    return this.toEntity(result.rows[0]);
  }

  async enqueue(connection, eventId, operation, now) {
    await connection.query(
      `INSERT INTO calendar_sync_outbox (id_event, operation, status, next_attempt_at, created_at)
       VALUES ($1, $2, 'pending', $3, $3)`,
      [eventId, operation, now]
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
      [logisticUserId, UserRole.LOGISTICA, UserStatus.ACTIVE]
    );

    if (!user.rows[0]) {
      return [{ type: "responsible", reason: "unavailable" }];
    }

    const overlaps = await connection.query(
      `SELECT folio, event_date_time, event_end_time
       FROM reservations_request
       WHERE logistic_user_id = $1
         AND id_reservation_request <> $2
         AND status = ANY($3)
         AND event_date_time < $4
         AND event_end_time > $5`,
      [logisticUserId, requestId, ActiveReservationRequestStatuses, endAt, startAt]
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
      `SELECT id_resource, SUM(quantity)::int AS quantity
       FROM reservation_resource_assignments
       WHERE id_request = $1 AND status = $2
       GROUP BY id_resource
       ORDER BY id_resource`,
      [requestId, ResourceAssignmentStatus.ASSIGNED]
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
      `SELECT a.id_resource, a.quantity, r.folio
       FROM reservation_resource_assignments a
       JOIN reservations_request r ON r.id_reservation_request = a.id_request
       JOIN calendar_events e ON e.id_request = a.id_request
       WHERE a.id_resource = ANY($1::bigint[])
         AND a.status = $2
         AND a.id_request <> $3
         AND r.status = ANY($4)
         AND e.start_at < $5
         AND e.end_at + make_interval(mins => $6::int) > $7`,
      [
        resourceIds,
        ResourceAssignmentStatus.ASSIGNED,
        requestId,
        ResourceBlockingEventStatuses,
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
      const used = overlapping.reduce((total, row) => total + row.quantity, 0);

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
      row.status,
      row.sync_status,
      row.google_event_id,
      new Date(row.created_at),
      new Date(row.updated_at)
    );
  }
}

module.exports = { PostgresCalendarEventRepository };
