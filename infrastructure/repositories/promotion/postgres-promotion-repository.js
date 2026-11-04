const { Promotion } = require("../../../domain/entities/promotion/promotion");
const PromotionStatus = require("../../../domain/enums/promotion/promotion-status");

class PostgresPromotionRepository {
  constructor(pool) {
    this.pool = pool;
  }

  async expireOutdatedPromotions(currentDate) {
    const result = await this.pool.query(
      `UPDATE promotions
       SET status = $1, updated_at = NOW()
       WHERE status = $2 AND valid_until < $3::date`,
      [PromotionStatus.INACTIVE, PromotionStatus.ACTIVE, currentDate]
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

  async update(id, { name, description, discount_percentage: discountPercentage, valid_until: validUntil }) {
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
}

module.exports = { PostgresPromotionRepository };

