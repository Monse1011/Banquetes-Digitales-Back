const { Service } = require("../../domain/entities/service");
const ServiceStatus = require("../../domain/enums/service-status");

class PostgresServiceRepository {
  constructor(pool) {
    this.pool = pool;
  }

  async findAll() {
    const result = await this.pool.query(
      `SELECT id_service, name, description, status
       FROM services
       WHERE status = $1
       ORDER BY id_service`,
      [ServiceStatus.ACTIVE]
    );

    return result.rows.map((row) => this.toEntity(row));
  }

  async findByIds(ids) {
    if (ids.length === 0) return [];

    const result = await this.pool.query(
      `SELECT id_service, name, description, status
       FROM services
       WHERE id_service = ANY($1::integer[])`,
      [ids]
    );

    return result.rows.map((row) => this.toEntity(row));
  }

  toEntity(row) {
    return new Service(row.id_service, row.name, row.description, row.status);
  }
}

module.exports = { PostgresServiceRepository };
