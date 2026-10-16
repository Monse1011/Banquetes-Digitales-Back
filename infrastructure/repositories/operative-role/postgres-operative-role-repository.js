const { OperativeRole } = require("../../../domain/entities/operative-role/operative-role");

class PostgresOperativeRoleRepository {
  constructor(pool) {
    this.pool = pool;
  }

  async findById(id) {
    const result = await this.pool.query(
      `SELECT id, name, is_active
       FROM operative_roles
       WHERE id = $1`,
      [id]
    );

    return result.rows[0] ? this.toEntity(result.rows[0]) : null;
  }

  async findByIds(ids) {
    const result = await this.pool.query(
      `SELECT id, name, is_active
       FROM operative_roles
       WHERE id = ANY($1)`,
      [ids]
    );

    return result.rows.map((row) => this.toEntity(row));
  }

  toEntity(row) {
    return new OperativeRole(Number(row.id), row.name, row.is_active);
  }
}

module.exports = { PostgresOperativeRoleRepository };
