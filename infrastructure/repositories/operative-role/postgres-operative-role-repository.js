const { OperativeRole } = require("../../../domain/entities/operative-role/operative-role");

class PostgresOperativeRoleRepository {
  constructor(pool) {
    this.pool = pool;
  }

  async findActive() {
    const result = await this.pool.query(
      "SELECT id, name, is_active FROM operative_roles WHERE is_active = true ORDER BY name"
    );
    return result.rows.map((row) => this.toEntity(row));
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

  async create(operativeRole) {
    const result = await this.pool.query(
      `INSERT INTO operative_roles (name, is_active)
       VALUES ($1, true)
       RETURNING id, name, is_active`,
      [operativeRole.name]
    );

    if (!result.rows[0]) {
      throw new Error("Operative role could not be created");
    }

    return this.toEntity(result.rows[0]);
  }

  async existsByName(name, excludeId) {
    const parameters = [name];
    const conditions = ["LOWER(TRIM(name)) = LOWER(TRIM($1))"];

    if (excludeId !== undefined) {
      parameters.push(excludeId);
      conditions.push(`id <> $${parameters.length}`);
    }

    const result = await this.pool.query(
      `SELECT EXISTS (
         SELECT 1 FROM operative_roles WHERE ${conditions.join(" AND ")}
       ) AS is_duplicate`,
      parameters
    );

    return result.rows[0]?.is_duplicate === true;
  }

  async update(operativeRole) {
    const result = await this.pool.query(
      `UPDATE operative_roles
       SET name = $1
       WHERE id = $2
       RETURNING id, name, is_active`,
      [operativeRole.name, operativeRole.id]
    );

    return result.rows[0] ? this.toEntity(result.rows[0]) : null;
  }

  async deactivate(id) {
    const result = await this.pool.query(
      `UPDATE operative_roles
       SET is_active = false
       WHERE id = $1
       RETURNING id, name, is_active`,
      [id]
    );

    return result.rows[0] ? this.toEntity(result.rows[0]) : null;
  }

  toEntity(row) {
    return new OperativeRole(Number(row.id), row.name, row.is_active);
  }
}

module.exports = { PostgresOperativeRoleRepository };
