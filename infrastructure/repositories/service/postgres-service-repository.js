const { Service } = require("../../../domain/entities/service/service");
const ServiceStatus = require("../../../domain/enums/service/service-status");

class PostgresServiceRepository {
  constructor(pool) {
    this.pool = pool;
  }

  async findAll() {
    const result = await this.pool.query(
      `SELECT id, name, description, status
       FROM services
       WHERE status = $1
       ORDER BY id`,
      ["ACTIVE"]
    );

    return result.rows.map((row) => this.toEntity(row));
  }

  // Contrato 12 (función 4.1): catálogo público con precio; orden name, id. AD-11:
  // devuelve la lista completa vigente (el front pagina en cliente).
  async findActiveForPortal() {
    const result = await this.pool.query(
      `SELECT id, name, description, price
       FROM services
       WHERE status = 'ACTIVE'
       ORDER BY name, id`
    );

    return result.rows.map((row) => ({
      id: Number(row.id),
      name: row.name,
      description: row.description,
      price: Number(row.price),
    }));
  }

  async findByIds(ids) {
    if (ids.length === 0) return [];

    const result = await this.pool.query(
      `SELECT id, name, description, status
       FROM services
       WHERE id = ANY($1::integer[])`,
      [ids]
    );

    return result.rows.map((row) => this.toEntity(row));
  }

  toEntity(row) {
    return new Service(
      Number(row.id),
      row.name,
      row.description,
      row.status === "ACTIVE" ? ServiceStatus.ACTIVE : ServiceStatus.INACTIVE
    );
  }
}

module.exports = { PostgresServiceRepository };
