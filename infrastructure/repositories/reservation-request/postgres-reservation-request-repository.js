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

const REQUEST_COLUMNS = `id_reservation_request, folio, id_client, id_user,
            event_date_time, event_end_time, guest_count, event_address, status,
            request_date, logistic_user_id, assigned_by_user_id, assigned_at,
            ARRAY[]::integer[] AS services_ids`;

class PostgresReservationRequestRepository {
  constructor(pool) {
    this.pool = pool;
  }

  async create(request) {
    const connection = await this.pool.connect();

    try {
      await connection.query("BEGIN");
      const result = await connection.query(
        `INSERT INTO reservations_request
          (folio, id_client, id_user, event_date_time, event_end_time, guest_count,
           event_address, status, request_date)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
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
        ` WHERE rr.id_reservation_request = $1
          GROUP BY rr.id_reservation_request`,
      [id]
    );

    return result.rows[0] ? this.toEntity(result.rows[0]) : null;
  }

  async update(request) {
    const connection = await this.pool.connect();

    try {
      await connection.query("BEGIN");
      const result = await connection.query(
        `UPDATE reservations_request
         SET folio = $1, id_client = $2, id_user = $3, event_date_time = $4,
             event_end_time = $5, guest_count = $6, event_address = $7, status = $8,
             request_date = $9
         WHERE id_reservation_request = $10
         RETURNING ${REQUEST_COLUMNS}`,
        [...this.requestValues(request), request.requestId]
      );

      if (!result.rows[0]) {
        throw new Error("Reservation request not found");
      }

      await this.replaceServices(connection, request.requestId, request.servicesIds);
      await connection.query("COMMIT");
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
    } catch (error) {
      await connection.query("ROLLBACK");
      throw error;
    } finally {
      connection.release();
    }
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
         WHERE id_reservation_request = $4 AND status = ANY($5)
           AND ($6::bigint IS NULL OR logistic_user_id IS NOT DISTINCT FROM $6::bigint)`,
        [
          ReservationRequestStatus.ASSIGNED,
          logisticUserId,
          assignedByUserId,
          requestId,
          ReassignableReservationRequestStatuses,
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
      `SELECT id_reservation_request, event_date_time, event_end_time, status
       FROM reservations_request
       WHERE id_reservation_request = $1
       FOR UPDATE`,
      [requestId]
    );
    const request = requestResult.rows[0];

    if (!request) {
      return { status: "not_found" };
    }

    if (!ReassignableReservationRequestStatuses.includes(request.status)) {
      return { status: "not_reassignable" };
    }

    const userResult = await connection.query(
      `SELECT id_user
       FROM users
       WHERE id_user = $1 AND role = $2 AND status = $3
       FOR UPDATE`,
      [logisticUserId, UserRole.LOGISTICA, UserStatus.ACTIVE]
    );

    if (!userResult.rows[0]) {
      return { status: "user_unavailable" };
    }

    const overlapResult = await connection.query(
      `SELECT folio, event_date_time, event_end_time
       FROM reservations_request
       WHERE logistic_user_id = $1
         AND id_reservation_request <> $2
         AND status = ANY($3)
         AND event_date_time < $4
         AND event_end_time > $5`,
      [
        logisticUserId,
        requestId,
        ActiveReservationRequestStatuses,
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
         AND id_reservation_request <> $2
         AND status = ANY($3)
         AND event_date_time < $4
         AND event_end_time > $5`,
      [logisticUserId, excludeRequestId, ActiveReservationRequestStatuses, end, start]
    );

    return result.rows.map((row) => ({
      folio: row.folio,
      startDateTime: new Date(row.event_date_time),
      endDateTime: new Date(row.event_end_time),
    }));
  }

  async findAll(filters, sort, page, perPage) {
    const parameters = [];
    const conditions = [];

    if (filters.status) {
      parameters.push(filters.status);
      conditions.push(`rr.status = $${parameters.length}`);
    }

    if (filters.eventDate) {
      parameters.push(this.datePart(filters.eventDate));
      conditions.push(`CAST(rr.event_date_time AS DATE) = $${parameters.length}`);
    }

    if (filters.clientName) {
      parameters.push(`%${filters.clientName}%`);
      conditions.push(`c.full_name ILIKE $${parameters.length}`);
    }

    const where = conditions.length > 0 ? ` WHERE ${conditions.join(" AND ")}` : "";
    const countResult = await this.pool.query(
      `SELECT COUNT(*)::int AS total_records
       FROM reservations_request rr
       JOIN clients c ON c.id_client = rr.id_client${where}`,
      parameters
    );

    const offset = (page - 1) * perPage;
    const sortColumn = this.sortColumn(sort.field);
    const direction = sort.direction === "desc" ? "DESC" : "ASC";
    const dataParameters = [...parameters, perPage, offset];
    const result = await this.pool.query(
      this.baseSelect() +
        `${where}
         GROUP BY rr.id_reservation_request
         ORDER BY ${sortColumn} ${direction}
         LIMIT $${dataParameters.length - 1} OFFSET $${dataParameters.length}`,
      dataParameters
    );

    return {
      requests: result.rows.map((row) => this.toEntity(row)),
      totalRecords: countResult.rows[0]?.total_records ?? 0,
    };
  }

  baseSelect() {
    return `SELECT rr.id_reservation_request, rr.folio, rr.id_client, rr.id_user,
      rr.event_date_time, rr.event_end_time, rr.guest_count, rr.event_address,
      rr.status, rr.request_date, rr.logistic_user_id, rr.assigned_by_user_id,
      rr.assigned_at,
      COALESCE(
        ARRAY_AGG(rs.id_service) FILTER (WHERE rs.id_service IS NOT NULL),
        ARRAY[]::integer[]
      ) AS services_ids
      FROM reservations_request rr
      JOIN clients c ON c.id_client = rr.id_client
      LEFT JOIN request_services rs
        ON rs.id_request = rr.id_reservation_request`;
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
      request.status,
      request.requestDate,
    ];
  }

  async replaceServices(connection, requestId, serviceIds) {
    await connection.query("DELETE FROM request_services WHERE id_request = $1", [requestId]);

    if (serviceIds.length === 0) return;

    const values = serviceIds.map((_serviceId, index) => `($1, $${index + 2})`).join(", ");

    await connection.query(
      `INSERT INTO request_services (id_request, id_service) VALUES ${values}`,
      [requestId, ...serviceIds]
    );
  }

  toEntity(row) {
    const serviceIds = row.services_ids.map((serviceId) => Number(serviceId));

    return new ReservationRequest(
      Number(row.id_reservation_request),
      row.folio,
      Number(row.id_client),
      row.id_user === null ? null : Number(row.id_user),
      new Date(row.event_date_time),
      new Date(row.event_end_time),
      row.guest_count,
      row.event_address,
      row.status,
      new Date(row.request_date),
      serviceIds,
      row.logistic_user_id === null ? null : Number(row.logistic_user_id),
      row.assigned_by_user_id === null ? null : Number(row.assigned_by_user_id),
      row.assigned_at === null ? null : new Date(row.assigned_at)
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
        return "rr.event_date_time";
    }
  }
}

module.exports = { PostgresReservationRequestRepository };
