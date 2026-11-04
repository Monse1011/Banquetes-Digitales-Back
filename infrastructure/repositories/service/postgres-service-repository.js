const { Service } = require("../../../domain/entities/service/service");
const ServiceStatus = require("../../../domain/enums/service/service-status");

class PostgresServiceRepository {
  constructor(pool) {
    this.pool = pool;
  }

  async findAll() {
    const result = await this.pool.query(
      `SELECT id, name, description, price, status
       FROM services
       WHERE status = $1 OR status = 'Vigente' OR status = 'activo'
       ORDER BY id`,
      [ServiceStatus.ACTIVE]
    );

    return result.rows.map((row) => this.toEntity(row));
  }

  async findByIds(ids) {
    if (ids.length === 0) return [];

    const result = await this.pool.query(
      `SELECT id, name, description, price, status
       FROM services
       WHERE id = ANY($1::integer[])`,
      [ids]
    );

    return result.rows.map((row) => this.toEntity(row));
  }

  async findAllNotDeleted({ page = 1, per_page: perPage = 10 } = {}) {
    const offset = (page - 1) * perPage;

    const countResult = await this.pool.query(
      `SELECT COUNT(*)::integer AS total
       FROM services
       WHERE status != $1 AND status != 'Eliminado'`,
      [ServiceStatus.DELETED]
    );

    const listResult = await this.pool.query(
      `SELECT id, name, description, price, status
       FROM services
       WHERE status != $1 AND status != 'Eliminado'
       ORDER BY (status = 'ACTIVE' OR status = 'Vigente' OR status = 'activo') DESC, name ASC, id ASC
       LIMIT $2 OFFSET $3`,
      [ServiceStatus.DELETED, perPage, offset]
    );

    return {
      services: listResult.rows.map((row) => this.toEntity(row)),
      total_records: countResult.rows[0].total,
    };
  }

  async findById(id) {
    const result = await this.pool.query(
      `SELECT id, name, description, price, status
       FROM services
       WHERE id = $1`,
      [id]
    );

    if (result.rows.length === 0) return null;
    return this.toEntity(result.rows[0]);
  }

  async getServiceById(id) {
    return this.findById(id);
  }

  async checkDuplicateActiveName(name) {
    const result = await this.pool.query(
      `SELECT COUNT(*)::integer AS count
       FROM services
       WHERE (status = 'ACTIVE' OR status = 'Vigente' OR status = 'activo')
         AND TRIM(LOWER(name)) = TRIM(LOWER($1))`,
      [name]
    );

    return result.rows[0].count > 0;
  }

  async checkDuplicateActiveNameExcludeId(name, id) {
    const result = await this.pool.query(
      `SELECT COUNT(*)::integer AS count
       FROM services
       WHERE (status = 'ACTIVE' OR status = 'Vigente' OR status = 'activo')
         AND TRIM(LOWER(name)) = TRIM(LOWER($1))
         AND id != $2`,
      [name, id]
    );

    return result.rows[0].count > 0;
  }

  async create({ name, description, price, status = ServiceStatus.ACTIVE }) {
    const result = await this.pool.query(
      `INSERT INTO services (name, description, price, status)
       VALUES ($1, $2, $3, $4)
       RETURNING id, name, description, price, status`,
      [name, description, price, status]
    );

    return this.toEntity(result.rows[0]);
  }

  async update(id, { name, description, price }) {
    const result = await this.pool.query(
      `UPDATE services
       SET name = $1, description = $2, price = $3
       WHERE id = $4
       RETURNING id, name, description, price, status`,
      [name, description, price, id]
    );

    if (result.rows.length === 0) return null;
    return this.toEntity(result.rows[0]);
  }

  async updateStatus(id, status) {
    const result = await this.pool.query(
      `UPDATE services
       SET status = $1
       WHERE id = $2
       RETURNING id, name, description, price, status`,
      [status, id]
    );

    if (result.rows.length === 0) return null;
    return this.toEntity(result.rows[0]);
  }

  async softDelete(id) {
    return this.updateStatus(id, ServiceStatus.DELETED);
  }

  toEntity(row) {
    if (!row) return null;

    let normalizedStatus = row.status;
    if (row.status === "ACTIVE" || row.status === "Vigente" || row.status === "activo") {
      normalizedStatus = ServiceStatus.ACTIVE;
    } else if (row.status === "INACTIVE" || row.status === "No vigente" || row.status === "inactivo") {
      normalizedStatus = ServiceStatus.INACTIVE;
    } else if (row.status === "DELETED" || row.status === "Eliminado") {
      normalizedStatus = ServiceStatus.DELETED;
    }

    return new Service(
      Number(row.id),
      row.name,
      row.description,
      row.price !== null && row.price !== undefined ? Number(row.price) : null,
      normalizedStatus
    );
  }
}

module.exports = { PostgresServiceRepository };
