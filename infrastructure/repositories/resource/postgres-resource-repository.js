const { Resource } = require("../../../domain/entities/resource/resource");
const { ResourceSortField } = require("../../../domain/enums/resource/resource-sort-field");
const { ResourceType } = require("../../../domain/enums/resource/resource-type");

const RESOURCE_COLUMNS = `id, name, type, operative_role_id, total_quantity, unit_cost,
  is_active, created_at, updated_at, deactivated_at, version`;

// La columna type guarda los valores en español; el dominio y la API usan los del contrato.
const DATABASE_TYPES = Object.freeze({
  [ResourceType.HUMAN]: "humano",
  [ResourceType.MATERIAL]: "material",
  [ResourceType.LOGISTIC]: "logistico",
});

const DOMAIN_TYPES = Object.freeze(
  Object.fromEntries(Object.entries(DATABASE_TYPES).map(([domain, database]) => [database, domain]))
);

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
        DATABASE_TYPES[resource.type],
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

  async findByIds(ids) {
    const result = await this.pool.query(
      `SELECT ${RESOURCE_COLUMNS}
       FROM resources
       WHERE id = ANY($1)`,
      [ids]
    );

    return result.rows.map((row) => this.toEntity(row));
  }

  // Solo escribe los datos editables; nunca el estado. Devuelve null si la versión cambió.
  async updateDetails(resource) {
    const result = await this.pool.query(
      `UPDATE resources
       SET name = $1, operative_role_id = $2, total_quantity = $3, unit_cost = $4,
           updated_at = $5, version = version + 1
       WHERE id = $6 AND version = $7
       RETURNING ${RESOURCE_COLUMNS}`,
      [
        resource.name,
        resource.operativeRoleId,
        resource.totalQuantity,
        resource.unitCost,
        resource.updatedAt,
        resource.id,
        resource.version,
      ]
    );

    return result.rows[0] ? this.toEntity(result.rows[0]) : null;
  }

  // Solo escribe el estado; nunca los datos editables. Devuelve null si la versión cambió.
  async updateStatus(resource) {
    const result = await this.pool.query(
      `UPDATE resources
       SET is_active = $1, deactivated_at = $2, updated_at = $3, version = version + 1
       WHERE id = $4 AND version = $5
       RETURNING ${RESOURCE_COLUMNS}`,
      [resource.isActive, resource.deactivatedAt, resource.updatedAt, resource.id, resource.version]
    );

    return result.rows[0] ? this.toEntity(result.rows[0]) : null;
  }

  async findAll(filters, sort, page, perPage) {
    const parameters = [];
    const conditions = [];

    if (filters.type) {
      parameters.push(DATABASE_TYPES[filters.type]);
      conditions.push(`type = $${parameters.length}`);
    }

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

    const where = conditions.length > 0 ? ` WHERE ${conditions.join(" AND ")}` : "";
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

  async existsByName(type, name, { operativeRoleId, activeOnly = false, excludeId } = {}) {
    const parameters = [DATABASE_TYPES[type], name];
    const conditions = ["type = $1", "LOWER(TRIM(name)) = LOWER(TRIM($2))"];

    if (operativeRoleId !== undefined) {
      parameters.push(operativeRoleId);
      conditions.push(`operative_role_id IS NOT DISTINCT FROM $${parameters.length}`);
    }

    if (activeOnly) {
      conditions.push("is_active = true");
    }

    if (excludeId !== undefined) {
      parameters.push(excludeId);
      conditions.push(`id <> $${parameters.length}`);
    }

    const result = await this.pool.query(
      `SELECT EXISTS (
         SELECT 1 FROM resources WHERE ${conditions.join(" AND ")}
       ) AS is_duplicate`,
      parameters
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
      DOMAIN_TYPES[row.type],
      row.operative_role_id === null ? null : Number(row.operative_role_id),
      row.total_quantity,
      row.unit_cost === null ? null : Number(row.unit_cost),
      row.is_active,
      new Date(row.created_at),
      new Date(row.updated_at),
      row.deactivated_at === null ? null : new Date(row.deactivated_at),
      row.version
    );
  }
}

module.exports = { PostgresResourceRepository };
