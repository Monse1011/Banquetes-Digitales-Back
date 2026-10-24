const {
  ResourceConfirmation,
} = require("../../../domain/entities/resource-assignment/resource-confirmation");

class PostgresResourceConfirmationRepository {
  constructor(pool) {
    this.pool = pool;
  }

  async create(confirmation, transaction = null) {
    const result = await this.executor(transaction).query(
      `INSERT INTO resource_confirmations
        (reservation_request_id, confirmed_by_user_id, confirmed_at, previous_status,
         current_status, sufficient_resources, insufficient_resources, observations)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING reservation_request_id, confirmed_by_user_id, confirmed_at, previous_status,
         current_status, sufficient_resources, insufficient_resources, observations`,
      [
        confirmation.requestId,
        confirmation.confirmedByUserId,
        confirmation.confirmedAt,
        confirmation.previousStatus,
        confirmation.currentStatus,
        confirmation.sufficientResources,
        confirmation.insufficientResources,
        confirmation.observations,
      ]
    );
    return this.toEntity(result.rows[0]);
  }

  async findLatestByRequest(requestId, transaction = null) {
    const result = await this.executor(transaction).query(
      `SELECT reservation_request_id, confirmed_by_user_id, confirmed_at, previous_status,
        current_status, sufficient_resources, insufficient_resources, observations
       FROM resource_confirmations
       WHERE reservation_request_id = $1
       ORDER BY confirmed_at DESC, id DESC
       LIMIT 1`,
      [requestId]
    );
    return result.rows[0] ? this.toEntity(result.rows[0]) : null;
  }

  async savePendingObservations(requestId, observations, transaction = null) {
    await this.executor(transaction).query(
      `INSERT INTO resource_confirmation_pending_observations
        (reservation_request_id, observations, updated_at)
       VALUES ($1, $2, NOW())
       ON CONFLICT (reservation_request_id)
       DO UPDATE SET observations = EXCLUDED.observations, updated_at = NOW()`,
      [requestId, observations]
    );
  }

  async findPendingObservations(requestId, transaction = null) {
    const result = await this.executor(transaction).query(
      `SELECT observations
       FROM resource_confirmation_pending_observations
       WHERE reservation_request_id = $1`,
      [requestId]
    );
    return result.rows[0]?.observations ?? null;
  }

  async deletePendingObservations(requestId, transaction = null) {
    await this.executor(transaction).query(
      `DELETE FROM resource_confirmation_pending_observations
       WHERE reservation_request_id = $1`,
      [requestId]
    );
  }

  executor(transaction) {
    return transaction?.connection ?? this.pool;
  }

  toEntity(row) {
    return new ResourceConfirmation(
      Number(row.reservation_request_id),
      row.confirmed_by_user_id === null ? null : Number(row.confirmed_by_user_id),
      new Date(row.confirmed_at),
      row.previous_status,
      row.current_status,
      Number(row.sufficient_resources),
      Number(row.insufficient_resources),
      row.observations
    );
  }
}

module.exports = { PostgresResourceConfirmationRepository };
