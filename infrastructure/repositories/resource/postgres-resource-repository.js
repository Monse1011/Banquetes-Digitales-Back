const { Resource } = require("../../../domain/entities/resource/resource");
const { ResourceSortField } = require("../../../domain/enums/resource/resource-sort-field");

const RESOURCE_COLUMNS = `id, name, type, operative_role_id, total_quantity, unit_cost,
  is_active, created_at, updated_at, deactivated_at`;

// Evita que %, _ o \ escritos por el usuario actúen como comodines en ILIKE.
function escapeLikePattern(value) {
  return value.replace(/[\\%_]/g, "\\$&");
}

class PostgresResourceRepository {
  constructor(pool) {
    this.pool = pool;
  }

  async create(resource) {
    const result = await this.pool.query(
      `INSERT INTO resources
        (name, type, operative_role_id, total_quantity, unit_cost,
         is_active, created_at, updated_at, deactivated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING ${RESOURCE_COLUMNS}`,
      [
        resource.name,
        resource.type,
        resource.operativeRoleId,
        resource.totalQuantity,
        resource.unitCost,
        resource.isActive,
        resource.createdAt,
        resource.updatedAt,
        resource.deactivatedAt,
      ]
    );

    if (!result.rows[0]) {
      throw new Error("Resource could not be created");
    }

    return this.toEntity(result.rows[0]);
  }

  async findById(id) {
    const result = await this.pool.query(
      `SELECT ${RESOURCE_COLUMNS}
       FROM resources
       WHERE id = $1`,
      [id]
    );

    return result.rows[0] ? this.toEntity(result.rows[0]) : null;
  }

  async update(resource) {
    const result = await this.pool.query(
      `UPDATE resources
       SET name = $1, operative_role_id = $2, total_quantity = $3, unit_cost = $4,
           is_active = $5, updated_at = $6, deactivated_at = $7
       WHERE id = $8
       RETURNING ${RESOURCE_COLUMNS}`,
      [
        resource.name,
        resource.operativeRoleId,
        resource.totalQuantity,
        resource.unitCost,
        resource.isActive,
        resource.updatedAt,
        resource.deactivatedAt,
        resource.id,
      ]
    );

    if (!result.rows[0]) {
      throw new Error("Resource not found");
    }

    return this.toEntity(result.rows[0]);
  }

  async findAll(filters, sort, page, perPage) {
    const parameters = [filters.type];
    const conditions = ["type = $1"];

    if (filters.isActive !== undefined) {
      parameters.push(filters.isActive);
      conditions.push(`is_active = $${parameters.length}`);
    }

    if (filters.name) {
      parameters.push(`%${escapeLikePattern(filters.name)}%`);
      conditions.push(`name ILIKE $${parameters.length}`);
    }

    if (filters.operativeRoleId !== undefined) {
      parameters.push(filters.operativeRoleId);
      conditions.push(`operative_role_id = $${parameters.length}`);
    }

    const where = ` WHERE ${conditions.join(" AND ")}`;
    const countResult = await this.pool.query(
      `SELECT COUNT(*)::int AS total_records FROM resources${where}`,
      parameters
    );

    const offset = (page - 1) * perPage;
    const direction = sort.direction === "desc" ? "DESC" : "ASC";
    const dataParameters = [...parameters, perPage, offset];
    const result = await this.pool.query(
      `SELECT ${RESOURCE_COLUMNS}
       FROM resources${where}
       ORDER BY ${this.sortColumn(sort.field)} ${direction}, id ASC
       LIMIT $${dataParameters.length - 1} OFFSET $${dataParameters.length}`,
      dataParameters
    );

    return {
      resources: result.rows.map((row) => this.toEntity(row)),
      totalRecords: countResult.rows[0]?.total_records ?? 0,
    };
  }

  async existsActiveByNameAndRole(type, name, operativeRoleId) {
    const result = await this.pool.query(
      `SELECT EXISTS (
         SELECT 1
         FROM resources
         WHERE type = $1
           AND is_active = true
           AND LOWER(TRIM(name)) = LOWER(TRIM($2))
           AND operative_role_id IS NOT DISTINCT FROM $3
       ) AS is_duplicate`,
      [type, name, operativeRoleId]
    );

    return result.rows[0]?.is_duplicate === true;
  }

  sortColumn(field) {
    switch (field) {
      case ResourceSortField.NAME:
        return "name";
    }
  }

  toEntity(row) {
    return new Resource(
      Number(row.id),
      row.name,
      row.type,
      row.operative_role_id === null ? null : Number(row.operative_role_id),
      row.total_quantity,
      row.unit_cost === null ? null : Number(row.unit_cost),
      row.is_active,
      new Date(row.created_at),
      new Date(row.updated_at),
      row.deactivated_at === null ? null : new Date(row.deactivated_at)
    );
  }
}

module.exports = { PostgresResourceRepository };
