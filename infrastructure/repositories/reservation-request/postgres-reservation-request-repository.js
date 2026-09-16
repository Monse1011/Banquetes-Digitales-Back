const {
  ReservationRequest,
} = require("../../../domain/entities/reservation-request/reservation-request");
const {
  ReservationRequestSortField,
} = require("../../../domain/enums/reservation-request/reservation-request-sort-field");

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
          (folio, id_client, id_user, event_date_time, guest_count,
           event_address, status, request_date)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         RETURNING id_reservation_request, folio, id_client, id_user,
           event_date_time, guest_count, event_address, status,
           request_date,
           ARRAY[]::integer[] AS services_ids`,
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
        createdRequest.guestCount,
        createdRequest.eventAddress,
        createdRequest.status,
        createdRequest.requestDate,
        request.servicesIds
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
             guest_count = $5, event_address = $6, status = $7, request_date = $8
         WHERE id_reservation_request = $9
         RETURNING id_reservation_request, folio, id_client, id_user,
           event_date_time, guest_count, event_address, status,
           request_date,
           ARRAY[]::integer[] AS services_ids`,
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
        updatedRequest.guestCount,
        updatedRequest.eventAddress,
        updatedRequest.status,
        updatedRequest.requestDate,
        request.servicesIds
      );
    } catch (error) {
      await connection.query("ROLLBACK");
      throw error;
    } finally {
      connection.release();
    }
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
      rr.event_date_time, rr.guest_count, rr.event_address, rr.status,
      rr.request_date,
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
      row.guest_count,
      row.event_address,
      row.status,
      new Date(row.request_date),
      serviceIds
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
