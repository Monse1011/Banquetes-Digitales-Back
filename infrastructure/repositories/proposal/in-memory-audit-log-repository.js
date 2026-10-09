// Réplica en memoria de PostgresAuditLogRepository para pruebas.
class InMemoryAuditLogRepository {
  constructor() {
    this.entries = [];
  }

  async record(entry) {
    this.entries.push({ ...entry, createdAt: new Date() });
  }
}

module.exports = { InMemoryAuditLogRepository };
