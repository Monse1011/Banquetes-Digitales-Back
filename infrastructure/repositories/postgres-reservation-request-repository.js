const { ReservationRequest } = require('../../domain/entities/reservation-request');
const { ReservationRequestSortField } = require('../../application/dto/reservation-request-sort');
const { ReservationRequestStatus } = require('../../domain/enums/request-status');

class PostgresReservationRequestRepository {
  constructor(pool) {
    this.pool = pool;
  }

  async create(request) {
    const connection = await this.pool.connect();

    try {
      await connection.query('BEGIN');
      const result = await connection.query(
        `INSERT INTO reservations_request
          (folio, id_client, id_user, event_date, event_time, guest_count,
           event_address, status, request_date, update_date)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
         RETURNING id_reservation_request, folio, id_client, id_user,
           event_date, event_time, guest_count, event_address, status,
           request_date, update_date,
           ARRAY[]::integer[] AS services_ids`,
        this.requestValues(request)
      );

      const row = result.rows[0];

      if (!row) {
        throw new Error("Reservation request could not be created");
      }

      const createdRequest = this.toEntity(row);
      await this.replaceServices(connection, createdRequest.id, request.servicesIds);
      await connection.query('COMMIT');

      return new ReservationRequest(
        createdRequest.id,
        createdRequest.folio,
        createdRequest.clientId,
        createdRequest.userId,
        createdRequest.eventDateTime,
        createdRequest.guestCount,
        createdRequest.eventAddress,
        createdRequest.status,
        createdRequest.requestDate,
        createdRequest.updateDate,
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
      await connection.query('BEGIN');
      const result = await connection.query(
        `UPDATE reservations_request
         SET folio = $1, id_client = $2, id_user = $3, event_date = $4,
             event_time = $5, guest_count = $6, event_address = $7,
             status = $8, request_date = $9, update_date = $10
         WHERE id_reservation_request = $11
         RETURNING id_reservation_request, folio, id_client, id_user,
           event_date, event_time, guest_count, event_address, status,
           request_date, update_date,
           ARRAY[]::integer[] AS services_ids`,
        [...this.requestValues(request), request.id]
      );

      if (!result.rows[0]) {
        throw new Error("Reservation request not found");
      }

      await this.replaceServices(connection, request.id, request.servicesIds);
      await connection.query('COMMIT');
      const updatedRequest = this.toEntity(result.rows[0]);

      return new ReservationRequest(
        updatedRequest.id,
        updatedRequest.folio,
        updatedRequest.clientId,
        updatedRequest.userId,
        updatedRequest.eventDateTime,
        updatedRequest.guestCount,
        updatedRequest.eventAddress,
        updatedRequest.status,
        updatedRequest.requestDate,
        updatedRequest.updateDate,
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
      conditions.push(`rr.event_date = $${parameters.length}`);
    }

    if (filters.clientName) {
      parameters.push(`%${filters.clientName}%`);
      conditions.push(`c.full_name ILIKE $${parameters.length}`);
    }

    const where = conditions.length > 0 ? ` WHERE ${conditions.join(' AND ')}` : '';
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
      rr.event_date, rr.event_time, rr.guest_count, rr.event_address, rr.status,
      rr.request_date, rr.update_date,
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
      this.datePart(request.eventDateTime),
      this.timePart(request.eventDateTime),
      request.guestCount,
      request.eventAddress,
      request.status,
      request.requestDate,
      request.updateDate,
    ];
  }

  async replaceServices(connection, requestId, serviceIds) {
    await connection.query(
      'DELETE FROM request_services WHERE id_request = $1',
      [requestId]
    );

    for (const serviceId of serviceIds) {
      await connection.query(
        `INSERT INTO request_services (id_request, id_service)
         VALUES ($1, $2)`,
        [requestId, serviceId]
      );
    }
  }

  toEntity(row) {
    const serviceIds = row.services_ids.map(serviceId => Number(serviceId));

    return new ReservationRequest(
      Number(row.id_reservation_request),
      row.folio,
      Number(row.id_client),
      row.id_user === null ? null : Number(row.id_user),
      this.combineDateAndTime(row.event_date, row.event_time),
      row.guest_count,
      row.event_address,
      row.status,
      new Date(row.request_date),
      new Date(row.update_date),
      serviceIds
    );
  }

  combineDateAndTime(eventDate, eventTime) {
    const date = eventDate instanceof Date
      ? eventDate.toISOString().slice(0, 10)
      : eventDate;
    const time = eventTime instanceof Date
      ? eventTime.toISOString().slice(11, 19)
      : eventTime;

    return new Date(`${date}T${time}Z`);
  }

  datePart(value) {
    return value.toISOString().slice(0, 10);
  }

  timePart(value) {
    return value.toISOString().slice(11, 19);
  }

  sortColumn(field) {
    switch (field) {
      case ReservationRequestSortField.ClientName:
        return "c.full_name";
      case ReservationRequestSortField.Status:
        return "rr.status";
      case ReservationRequestSortField.EventDate:
        return "rr.event_date";
    }
  }
}

module.exports = { PostgresReservationRequestRepository };
