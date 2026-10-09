class PostgresAuditLogRepository {
  constructor(pool) {
    this.pool = pool;
  }

  async record({ userId, action, entityId, previousData, newData }) {
    await this.pool.query(
      `INSERT INTO audit_logs (user_id, action, entity_id, previous_data, new_data)
       VALUES ($1, $2, $3, $4, $5)`,
      [
        userId,
        action,
        entityId,
        previousData ? JSON.stringify(previousData) : null,
        newData ? JSON.stringify(newData) : null,
      ]
    );
  }
}

module.exports = { PostgresAuditLogRepository };
