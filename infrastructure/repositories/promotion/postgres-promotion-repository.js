const { Promotion } = require("../../../domain/entities/promotion/promotion");
const PromotionStatus = require("../../../domain/enums/promotion/promotion-status");

// Fecha actual de Mérida evaluada por la base de datos. AD-06: el UPDATE de expiración
// (RF-1.2.7.5 / RF-1.2.7.7) tiene una sola implementación, invocada tanto por la gestión
// de la Función 2.7 (contratos 6 a 10) como por el catálogo público de la Función 4.1
// (contrato 11).
const MERIDA_TODAY = "(now() AT TIME ZONE 'America/Merida')::date";

class PostgresPromotionRepository {
  constructor(pool) {
    this.pool = pool;
  }

  // Expiración idempotente: ACTIVE cuya valid_until quedó atrás pasa a INACTIVE (AD-06).
  // Con currentDate la invoca la gestión (Función 2.7); sin argumento expireOutdated()
  // usa la fecha de Mérida evaluada por la base, como la necesita el contrato 11.
  async expireOutdatedPromotions(currentDate) {
    if (currentDate === undefined || currentDate === null) {
      return this.expireOutdated();
    }

    const result = await this.pool.query(
      `UPDATE promotions
       SET status = $1, updated_at = NOW()
       WHERE status = $2 AND valid_until < $3::date`,
      [PromotionStatus.INACTIVE, PromotionStatus.ACTIVE, currentDate]
    );

    return result.rowCount || 0;
  }

  // UPDATE idempotente sin parámetro (RF-1.2.7.5 / RF-1.2.7.7). Devuelve el número de
  // filas marcadas (0 en casi todas las llamadas).
  async expireOutdated() {
    const result = await this.pool.query(
      `UPDATE promotions
       SET status = $1, updated_at = NOW()
       WHERE status = $2 AND valid_until < ${MERIDA_TODAY}`,
      [PromotionStatus.INACTIVE, PromotionStatus.ACTIVE]
    );

    return result.rowCount || 0;
  }

  async findAllNotDeleted({ page = 1, per_page: perPage = 10, currentDate } = {}) {
    if (currentDate) {
      await this.expireOutdatedPromotions(currentDate);
    }

    const offset = (page - 1) * perPage;

    const countResult = await this.pool.query(
      `SELECT COUNT(*)::integer AS total
       FROM promotions
       WHERE status != $1`,
      [PromotionStatus.DELETED]
    );

    const listResult = await this.pool.query(
      `SELECT id, name, description, discount_percentage, to_char(valid_until, 'YYYY-MM-DD') AS valid_until, status, created_at, updated_at
       FROM promotions
       WHERE status != $1
       ORDER BY (status = 'ACTIVE') DESC, name ASC, id ASC
       LIMIT $2 OFFSET $3`,
      [PromotionStatus.DELETED, perPage, offset]
    );

    return {
      promotions: listResult.rows.map((row) => this.toEntity(row)),
      total_records: countResult.rows[0].total,
    };
  }

  async findAllActive({ page = 1, per_page: perPage = 10, currentDate } = {}) {
    if (currentDate) {
      await this.expireOutdatedPromotions(currentDate);
    }

    const offset = (page - 1) * perPage;

    const countResult = await this.pool.query(
      `SELECT COUNT(*)::integer AS total
       FROM promotions
       WHERE status = $1 AND valid_until >= $2::date`,
      [PromotionStatus.ACTIVE, currentDate]
    );

    const listResult = await this.pool.query(
      `SELECT id, name, description, discount_percentage, to_char(valid_until, 'YYYY-MM-DD') AS valid_until, status, created_at, updated_at
       FROM promotions
       WHERE status = $1 AND valid_until >= $2::date
       ORDER BY name ASC, id ASC
       LIMIT $3 OFFSET $4`,
      [PromotionStatus.ACTIVE, currentDate, perPage, offset]
    );

    return {
      promotions: listResult.rows.map((row) => this.toEntity(row)),
      total_records: countResult.rows[0].total,
    };
  }

  async findById(id) {
    const result = await this.pool.query(
      `SELECT id, name, description, discount_percentage, to_char(valid_until, 'YYYY-MM-DD') AS valid_until, status, created_at, updated_at
       FROM promotions
       WHERE id = $1`,
      [id]
    );

    if (result.rows.length === 0) return null;
    return this.toEntity(result.rows[0]);
  }

  async checkDuplicateActiveName(name, currentDate) {
    if (currentDate) {
      await this.expireOutdatedPromotions(currentDate);
    }

    const result = await this.pool.query(
      `SELECT COUNT(*)::integer AS count
       FROM promotions
       WHERE status = $1
         AND valid_until >= $2::date
         AND TRIM(LOWER(name)) = TRIM(LOWER($3))`,
      [PromotionStatus.ACTIVE, currentDate, name]
    );

    return result.rows[0].count > 0;
  }

  async checkDuplicateActiveNameExcludeId(name, id, currentDate) {
    if (currentDate) {
      await this.expireOutdatedPromotions(currentDate);
    }

    const result = await this.pool.query(
      `SELECT COUNT(*)::integer AS count
       FROM promotions
       WHERE status = $1
         AND valid_until >= $2::date
         AND TRIM(LOWER(name)) = TRIM(LOWER($3))
         AND id != $4`,
      [PromotionStatus.ACTIVE, currentDate, name, id]
    );

    return result.rows[0].count > 0;
  }

  async create({
    name,
    description,
    discount_percentage: discountPercentage,
    valid_until: validUntil,
    status = PromotionStatus.ACTIVE,
  }) {
    const result = await this.pool.query(
      `INSERT INTO promotions (name, description, discount_percentage, valid_until, status)
       VALUES ($1, $2, $3, $4::date, $5)
       RETURNING id, name, description, discount_percentage, to_char(valid_until, 'YYYY-MM-DD') AS valid_until, status, created_at, updated_at`,
      [name, description, discountPercentage, validUntil, status]
    );

    return this.toEntity(result.rows[0]);
  }

  async update(
    id,
    { name, description, discount_percentage: discountPercentage, valid_until: validUntil }
  ) {
    const result = await this.pool.query(
      `UPDATE promotions
       SET name = $1, description = $2, discount_percentage = $3, valid_until = $4::date, updated_at = NOW()
       WHERE id = $5
       RETURNING id, name, description, discount_percentage, to_char(valid_until, 'YYYY-MM-DD') AS valid_until, status, created_at, updated_at`,
      [name, description, discountPercentage, validUntil, id]
    );

    if (result.rows.length === 0) return null;
    return this.toEntity(result.rows[0]);
  }

  async updateStatus(id, status) {
    const result = await this.pool.query(
      `UPDATE promotions
       SET status = $1, updated_at = NOW()
       WHERE id = $2
       RETURNING id, name, description, discount_percentage, to_char(valid_until, 'YYYY-MM-DD') AS valid_until, status, created_at, updated_at`,
      [status, id]
    );

    if (result.rows.length === 0) return null;
    return this.toEntity(result.rows[0]);
  }

  async softDelete(id, currentDate) {
    if (currentDate) {
      await this.expireOutdatedPromotions(currentDate);
    }
    return this.updateStatus(id, PromotionStatus.DELETED);
  }

  toEntity(row) {
    if (!row) return null;

    return new Promotion(
      Number(row.id),
      row.name,
      row.description,
      row.discount_percentage !== null && row.discount_percentage !== undefined
        ? Number(row.discount_percentage)
        : null,
      row.valid_until,
      row.status,
      row.created_at,
      row.updated_at
    );
  }

  // RF-3.4.1.2.2 (contrato 11, Función 4.1): solo vigentes (ACTIVE y valid_until >= hoy de
  // Mérida), orden name, id. La expiración previa corre a cargo de expireOutdated().
  async listActiveForPortal() {
    const result = await this.pool.query(
      `SELECT id, name, description, discount_percentage,
              TO_CHAR(valid_until, 'YYYY-MM-DD') AS valid_until
         FROM promotions
        WHERE status = 'ACTIVE' AND valid_until >= ${MERIDA_TODAY}
        ORDER BY name, id`
    );

    return result.rows.map((row) => ({
      id: Number(row.id),
      name: row.name,
      description: row.description,
      discount_percentage: Number(row.discount_percentage),
      valid_until: row.valid_until,
    }));
  }
}

module.exports = { PostgresPromotionRepository };
