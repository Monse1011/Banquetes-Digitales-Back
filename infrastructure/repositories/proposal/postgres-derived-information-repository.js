const { DerivedInformation } = require("../../../domain/entities/proposal/derived-information");

class PostgresDerivedInformationRepository {
  constructor(pool) {
    this.pool = pool;
  }

  async lockRequest(requestId, transaction) {
    await transaction.connection.query(
      "SELECT id FROM reservations_request WHERE id = $1 FOR UPDATE",
      [requestId]
    );
  }

  async create(information, transaction = null) {
    const connection = transaction?.connection ?? this.pool;
    const result = await connection.query(
      `INSERT INTO derived_information
        (request_id, location, start_datetime, end_datetime, observations,
         created_by_user_id)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, request_id, location, start_datetime, end_datetime,
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

  async findByIdAndRequestId(id, requestId, transaction = null) {
    const result = await (transaction?.connection ?? this.pool).query(
      `SELECT id, request_id, location, start_datetime, end_datetime,
        observations, created_by_user_id, created_at
       FROM derived_information
       WHERE id = $1 AND request_id = $2`,
      [id, requestId]
    );

    return result.rows[0] ? this.toEntity(result.rows[0]) : null;
  }

  async findLatestByRequestId(requestId, transaction = null) {
    const result = await (transaction?.connection ?? this.pool).query(
      `SELECT id, request_id, location, start_datetime, end_datetime,
        observations, created_by_user_id, created_at
       FROM derived_information
       WHERE request_id = $1
       ORDER BY id DESC
       LIMIT 1`,
      [requestId]
    );

    return result.rows[0] ? this.toEntity(result.rows[0]) : null;
  }

  toEntity(row) {
    return new DerivedInformation(
      Number(row.id),
      Number(row.request_id),
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
