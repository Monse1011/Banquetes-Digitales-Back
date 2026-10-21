const { toDatabaseStatus, fromDatabaseStatus } = require("./postgres-request-status");
const {
  ReservationRequest,
} = require("../../../domain/entities/reservation-request/reservation-request");
const {
  ReservationRequestStatus,
  ActiveReservationRequestStatuses,
  ReassignableReservationRequestStatuses,
} = require("../../../domain/enums/reservation-request/request-status");
const {
  ReservationRequestSortField,
} = require("../../../domain/enums/reservation-request/reservation-request-sort-field");
const UserRole = require("../../../domain/enums/auth/user-role");
const UserStatus = require("../../../domain/enums/auth/user-status");

const REQUEST_COLUMNS = `id, folio, client_id, reviewed_by_user_id,
            event_date_time, event_end_time, guest_count, event_address, status,
            request_date, logistic_user_id, assigned_by_user_id, assigned_at,
            ARRAY[]::integer[] AS services_ids`;

function addStatusCondition(filters, parameters, conditions) {
  const statusList = filters.statuses || (filters.status ? [filters.status].flat() : null);
  if (!statusList) return;
  parameters.push(statusList.map(toDatabaseStatus));
  conditions.push(`rr.status = ANY($${parameters.length})`);
}

class PostgresReservationRequestRepository {
  constructor(pool) {
    this.pool = pool;
  }

  buildConditions(filters, parameters) {
    const conditions = [];

    addStatusCondition(filters, parameters, conditions);

    const logisticUserId = filters.logisticUserId ?? filters.logistic_user_id;
    if (logisticUserId !== undefined && logisticUserId !== null) {
      parameters.push(logisticUserId);
      conditions.push(`rr.logistic_user_id = $${parameters.length}`);
    }

    if (filters.eventDate) {
      parameters.push(this.datePart(filters.eventDate));
      conditions.push(`CAST(rr.event_date_time AS DATE) = $${parameters.length}`);
    }

    if (filters.clientName) {
      parameters.push(`%${filters.clientName}%`);
      conditions.push(`c.full_name ILIKE $${parameters.length}`);
    }

    return conditions.length > 0 ? ` WHERE ${conditions.join(" AND ")}` : "";
  }

  async create(request) {
    const connection = await this.pool.connect();

    try {
      await connection.query("BEGIN");
      const result = await connection.query(
        `INSERT INTO reservations_request
          (folio, client_id, reviewed_by_user_id, event_date, event_time, event_end_time, guest_count,
           event_address, status, request_date)
         VALUES ($1, $2, $3, ($4::timestamptz AT TIME ZONE 'America/Merida')::date, ($4::timestamptz AT TIME ZONE 'America/Merida')::time, $5, $6, $7, $8, $9)
         RETURNING ${REQUEST_COLUMNS}`,
        this.requestValues(request)
      );

      const row = result.rows[0];

      if (!row) {
        throw new Error("Reservation request could not be created");
      }

      const createdRequest = this.toEntity(row);
      await this.replaceServices(connection, createdRequest.requestId, request.servicesIds);
      await connection.query("COMMIT");

      return new ReservationRequest(
        createdRequest.requestId,
        createdRequest.folio,
        createdRequest.clientId,
        createdRequest.userId,
        createdRequest.eventDateTime,
        createdRequest.eventEndTime,
        createdRequest.guestCount,
        createdRequest.eventAddress,
        createdRequest.status,
        createdRequest.requestDate,
        request.servicesIds,
        createdRequest.logisticUserId,
        createdRequest.assignedByUserId,
        createdRequest.assignedAt
      );
    } catch (error) {
      await connection.query("ROLLBACK");
      throw error;
    } finally {
      connection.release();
    }
  }

  async findById(id) {
    const result = await this.pool.query(
      this.baseSelect() +
        ` WHERE rr.id = $1
          GROUP BY rr.id, c.id, c.full_name, c.email, c.phone`,
      [id]
    );

    return result.rows[0] ? this.toEntity(result.rows[0]) : null;
  }

  // Con transaction, la actualización forma parte de esa transacción (Función 3.2).
  async update(request, transaction = null) {
    if (transaction) {
      return this.updateWith(transaction.connection, request);
    }

    const connection = await this.pool.connect();

    try {
      await connection.query("BEGIN");
      const updatedRequest = await this.updateWith(connection, request);
      await connection.query("COMMIT");

      return updatedRequest;
    } catch (error) {
      await connection.query("ROLLBACK");
      throw error;
    } finally {
      connection.release();
    }
  }

  async updateWith(connection, request) {
    const result = await connection.query(
      `UPDATE reservations_request
       SET folio = $1, client_id = $2, reviewed_by_user_id = $3, event_date = ($4::timestamptz AT TIME ZONE 'America/Merida')::date, event_time = ($4::timestamptz AT TIME ZONE 'America/Merida')::time,
           event_end_time = $5, guest_count = $6, event_address = $7, status = $8,
           request_date = $9
       WHERE id = $10
       RETURNING ${REQUEST_COLUMNS}`,
      [...this.requestValues(request), request.requestId]
    );

    if (!result.rows[0]) {
      throw new Error("Reservation request not found");
    }

    await this.replaceServices(connection, request.requestId, request.servicesIds);
    const updatedRequest = this.toEntity(result.rows[0]);

    return new ReservationRequest(
      updatedRequest.requestId,
      updatedRequest.folio,
      updatedRequest.clientId,
      updatedRequest.userId,
      updatedRequest.eventDateTime,
      updatedRequest.eventEndTime,
      updatedRequest.guestCount,
      updatedRequest.eventAddress,
      updatedRequest.status,
      updatedRequest.requestDate,
      request.servicesIds,
      updatedRequest.logisticUserId,
      updatedRequest.assignedByUserId,
      updatedRequest.assignedAt
    );
  }

  // RF-1.2.4.7: la (re)asignación se registra de forma atómica. El bloqueo de la fila
  // de la solicitud y de la fila del empleado impide que dos asignaciones simultáneas
  // deriven en la misma solicitud doblemente asignada o en horarios traslapados.
  // currentLogisticUserId actúa como_expected de concurrencia optimista: si el
  // responsable actual ya no coincide, la actualización no afecta filas.
  async assign(requestId, logisticUserId, assignedByUserId, currentLogisticUserId = null) {
    const connection = await this.pool.connect();

    try {
      await connection.query("BEGIN");

      const rejection = await this.validateAssignment(connection, requestId, logisticUserId);

      if (rejection) {
        await connection.query("ROLLBACK");
        return rejection;
      }

      // RF-1.2.4.3 / RF-1.2.4.14: cambio de estado y registro de la asignación.
      const updateResult = await connection.query(
        `UPDATE reservations_request
         SET status = $1, logistic_user_id = $2, assigned_by_user_id = $3,
             assigned_at = NOW()
         WHERE id = $4 AND status = ANY($5)
           AND ($6::bigint IS NULL OR logistic_user_id IS NOT DISTINCT FROM $6::bigint)`,
        [
          toDatabaseStatus(ReservationRequestStatus.ASSIGNED),
          logisticUserId,
          assignedByUserId,
          requestId,
          ReassignableReservationRequestStatuses.map(toDatabaseStatus),
          currentLogisticUserId,
        ]
      );

      if (updateResult.rowCount === 0) {
        await connection.query("ROLLBACK");
        return { status: "assignment_conflict" };
      }

      await connection.query("COMMIT");

      return { status: "assigned" };
    } catch (error) {
      await connection.query("ROLLBACK");
      throw error;
    } finally {
      connection.release();
    }
  }

  async validateAssignment(connection, requestId, logisticUserId) {
    const requestResult = await connection.query(
      `SELECT id, event_date_time, event_end_time, status
       FROM reservations_request
       WHERE id = $1
       FOR UPDATE`,
      [requestId]
    );
    const request = requestResult.rows[0];

    if (!request) {
      return { status: "not_found" };
    }

    if (!ReassignableReservationRequestStatuses.includes(fromDatabaseStatus(request.status))) {
      return { status: "not_reassignable" };
    }

    const userResult = await connection.query(
      `SELECT id_user
       FROM users
       WHERE id_user = $1 AND role = $2 AND status = $3
       FOR UPDATE`,
      [logisticUserId, UserRole.LOGISTICS, UserStatus.ACTIVE.toUpperCase()]
    );

    if (!userResult.rows[0]) {
      return { status: "user_unavailable" };
    }

    const overlapResult = await connection.query(
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
        request.event_end_time,
        request.event_date_time,
      ]
    );

    if (overlapResult.rows.length > 0) {
      return {
        status: "overlap",
        conflicts: overlapResult.rows.map((row) => ({
          folio: row.folio,
          startDateTime: new Date(row.event_date_time),
          endDateTime: new Date(row.event_end_time),
        })),
      };
    }

    return undefined;
  }

  // Función 3.4 (RF-2.3.4.10): traslapes de agenda del responsable al cambiar el
  // horario confirmado de una solicitud.
  async findOverlappingByLogisticUser(logisticUserId, excludeRequestId, start, end) {
    const result = await this.pool.query(
      `SELECT folio, event_date_time, event_end_time
       FROM reservations_request
       WHERE logistic_user_id = $1
         AND id <> $2
         AND status = ANY($3)
         AND event_date_time < $4
         AND event_end_time > $5`,
      [
        logisticUserId,
        excludeRequestId,
        ActiveReservationRequestStatuses.map(toDatabaseStatus),
        end,
        start,
      ]
    );

    return result.rows.map((row) => ({
      folio: row.folio,
      startDateTime: new Date(row.event_date_time),
      endDateTime: new Date(row.event_end_time),
    }));
  }

  async findAll(filters = {}, sort = null, page = 1, perPage = 10) {
    const parameters = [];
    const where = this.buildConditions(filters, parameters);

    const countResult = await this.pool.query(
      `SELECT COUNT(DISTINCT rr.id)::int AS total_records
       FROM reservations_request rr
       JOIN clients c ON c.id = rr.client_id${where}`,
      parameters
    );

    const offset = (page - 1) * perPage;
    let orderClause = "ORDER BY rr.event_date_time ASC, rr.folio ASC";
    if (sort && sort.field) {
      const sortColumn = this.sortColumn(sort.field);
      const direction = sort.direction === "desc" ? "DESC" : "ASC";
      orderClause = `ORDER BY ${sortColumn} ${direction}, rr.folio ${direction}`;
    }

    const dataParameters = [...parameters, perPage, offset];
    const result = await this.pool.query(
      this.baseSelect() +
        `${where}
         GROUP BY rr.id, c.id, c.full_name, c.email, c.phone
         ${orderClause}
         LIMIT $${dataParameters.length - 1} OFFSET $${dataParameters.length}`,
      dataParameters
    );

    return {
      requests: result.rows.map((row) => this.toEntity(row)),
      totalRecords: countResult.rows[0]?.total_records ?? 0,
    };
  }

  baseSelect() {
    return `SELECT rr.id, rr.folio, rr.client_id, rr.reviewed_by_user_id,
      rr.event_date_time, rr.event_end_time, rr.guest_count, rr.event_address,
      rr.status, rr.request_date, rr.logistic_user_id, rr.assigned_by_user_id,
      rr.assigned_at,
      c.full_name AS client_name, c.email AS client_email, c.phone AS client_phone,
      COALESCE(
        ARRAY_AGG(rs.service_id) FILTER (WHERE rs.service_id IS NOT NULL),
        ARRAY[]::integer[]
      ) AS services_ids
      FROM reservations_request rr
      JOIN clients c ON c.id = rr.client_id
      LEFT JOIN request_services rs
        ON rs.request_id = rr.id`;
  }

  requestValues(request) {
    return [
      request.folio,
      request.clientId,
      request.userId,
      request.eventDateTime,
      request.eventEndTime,
      request.guestCount,
      request.eventAddress,
      toDatabaseStatus(request.status),
      request.requestDate,
    ];
  }

  async replaceServices(connection, requestId, serviceIds) {
    await connection.query("DELETE FROM request_services WHERE request_id = $1", [requestId]);

    if (serviceIds.length === 0) return;

    const values = serviceIds.map((_serviceId, index) => `($1, $${index + 2})`).join(", ");

    await connection.query(
      `INSERT INTO request_services (request_id, service_id) VALUES ${values}`,
      [requestId, ...serviceIds]
    );
  }

  toEntity(row) {
    const serviceIds = row.services_ids
      ? row.services_ids.map((serviceId) => Number(serviceId))
      : [];

    return new ReservationRequest(
      Number(row.id),
      row.folio,
      Number(row.client_id),
      row.reviewed_by_user_id === null ? null : Number(row.reviewed_by_user_id),
      new Date(row.event_date_time),
      new Date(row.event_end_time),
      row.guest_count,
      row.event_address,
      fromDatabaseStatus(row.status),
      new Date(row.request_date),
      serviceIds,
      row.logistic_user_id === null ? null : Number(row.logistic_user_id),
      row.assigned_by_user_id === null ? null : Number(row.assigned_by_user_id),
      row.assigned_at === null ? null : new Date(row.assigned_at),
      row.client_name ?? null,
      row.client_email ?? null,
      row.client_phone ?? null
    );
  }

  datePart(value) {
    return value.toISOString().slice(0, 10);
  }

  sortColumn(field) {
    switch (field) {
      case ReservationRequestSortField.CLIENT_NAME:
        return "c.full_name";
      case ReservationRequestSortField.STATUS:
        return "rr.status";
      case ReservationRequestSortField.EVENT_DATE:
      default:
        return "rr.event_date_time";
    }
  }
}

module.exports = { PostgresReservationRequestRepository };
