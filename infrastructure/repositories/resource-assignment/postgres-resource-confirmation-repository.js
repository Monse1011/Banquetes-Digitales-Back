const {
  ResourceConfirmation,
} = require("../../../domain/entities/resource-assignment/resource-confirmation");
const {
  toDatabaseStatus,
  fromDatabaseStatus,
} = require("../reservation-request/postgres-request-status");

// Los estados se guardan con los códigos de reservations_request (DAD v3.0).
const CONFIRMATION_COLUMNS = `request_id, confirmed_by_user_id, confirmed_at, previous_status,
  resulting_status, sufficient_count, insufficient_count, observations`;

class PostgresResourceConfirmationRepository {
  constructor(pool) {
    this.pool = pool;
  }

  async create(confirmation, transaction = null) {
    const result = await this.executor(transaction).query(
      `INSERT INTO resource_confirmations
        (${CONFIRMATION_COLUMNS}, is_fully_sufficient)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $7 = 0)
       RETURNING ${CONFIRMATION_COLUMNS}`,
      [
        confirmation.requestId,
        confirmation.confirmedByUserId,
        confirmation.confirmedAt,
        toDatabaseStatus(confirmation.previousStatus),
        toDatabaseStatus(confirmation.currentStatus),
        confirmation.sufficientResources,
        confirmation.insufficientResources,
        confirmation.observations,
      ]
    );
    return this.toEntity(result.rows[0]);
  }

  async findLatestByRequest(requestId, transaction = null) {
    const result = await this.executor(transaction).query(
      `SELECT ${CONFIRMATION_COLUMNS}
       FROM resource_confirmations
       WHERE request_id = $1
       ORDER BY confirmed_at DESC, id DESC
       LIMIT 1`,
      [requestId]
    );
    return result.rows[0] ? this.toEntity(result.rows[0]) : null;
  }

  async savePendingObservations(requestId, observations, transaction = null) {
    await this.executor(transaction).query(
      `INSERT INTO resource_confirmation_pending_observations
        (request_id, observations, updated_at)
       VALUES ($1, $2, NOW())
       ON CONFLICT (request_id)
       DO UPDATE SET observations = EXCLUDED.observations, updated_at = NOW()`,
      [requestId, observations]
    );
  }

  async findPendingObservations(requestId, transaction = null) {
    const result = await this.executor(transaction).query(
      `SELECT observations
       FROM resource_confirmation_pending_observations
       WHERE request_id = $1`,
      [requestId]
    );
    return result.rows[0]?.observations ?? null;
  }

  async deletePendingObservations(requestId, transaction = null) {
    await this.executor(transaction).query(
      `DELETE FROM resource_confirmation_pending_observations
       WHERE request_id = $1`,
      [requestId]
    );
  }

  executor(transaction) {
    return transaction?.connection ?? this.pool;
  }

  toEntity(row) {
    return new ResourceConfirmation(
      Number(row.request_id),
      row.confirmed_by_user_id === null ? null : Number(row.confirmed_by_user_id),
      new Date(row.confirmed_at),
      fromDatabaseStatus(row.previous_status),
      fromDatabaseStatus(row.resulting_status),
      Number(row.sufficient_count),
      Number(row.insufficient_count),
      row.observations
    );
  }
}

module.exports = { PostgresResourceConfirmationRepository };
