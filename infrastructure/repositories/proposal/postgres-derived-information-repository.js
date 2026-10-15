const { DerivedInformation } = require("../../../domain/entities/proposal/derived-information");

class PostgresDerivedInformationRepository {
  constructor(pool) {
    this.pool = pool;
  }

  async create(information) {
    const result = await this.pool.query(
      `INSERT INTO derived_information
        (event_request_id, location, start_datetime, end_datetime, observations,
         created_by_user_id)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, event_request_id, location, start_datetime, end_datetime,
         observations, created_by_user_id, created_at`,
      [
        information.eventRequestId,
        information.location,
        information.startDatetime,
        information.endDatetime,
        information.observations,
        information.createdByUserId,
      ]
    );

    return this.toEntity(result.rows[0]);
  }

  async findByIdAndRequestId(id, requestId) {
    const result = await this.pool.query(
      `SELECT id, event_request_id, location, start_datetime, end_datetime,
        observations, created_by_user_id, created_at
       FROM derived_information
       WHERE id = $1 AND event_request_id = $2`,
      [id, requestId]
    );

    return result.rows[0] ? this.toEntity(result.rows[0]) : null;
  }

  async findLatestByRequestId(requestId) {
    const result = await this.pool.query(
      `SELECT id, event_request_id, location, start_datetime, end_datetime,
        observations, created_by_user_id, created_at
       FROM derived_information
       WHERE event_request_id = $1
       ORDER BY id DESC
       LIMIT 1`,
      [requestId]
    );

    return result.rows[0] ? this.toEntity(result.rows[0]) : null;
  }

  toEntity(row) {
    return new DerivedInformation(
      Number(row.id),
      Number(row.event_request_id),
      row.location,
      new Date(row.start_datetime),
      new Date(row.end_datetime),
      row.observations,
      row.created_by_user_id === null ? null : Number(row.created_by_user_id),
      new Date(row.created_at)
    );
  }
}

module.exports = { PostgresDerivedInformationRepository };
