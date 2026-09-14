const Block = require("../../domain/entities/block");

const BLOCK_DURATION_MINUTES = 15;

class PostgresBlockRepository {
  constructor(pool) {
    this.pool = pool;
  }

  async findByUserId(idUser) {
    const result = await this.pool.query(
      `
            SELECT id_block, id_user, failed_attempts, blocked_until
            FROM blocks WHERE id_user = $1`,
      [idUser]
    );
    return result.rows[0] ? this.toEntity(result.rows[0]) : null;
  }

  async incrementFailedAttempts(idUser) {
    const result = await this.pool.query(
      `
            INSERT INTO blocks (id_user, failed_attempts)
            VALUES ($1, 1)
            ON CONFLICT (id_user)
            DO UPDATE SET failed_attempts = blocks.failed_attempts + 1
            RETURNING *`,
      [idUser]
    );
    return this.toEntity(result.rows[0]);
  }

  async blockUser(idUser) {
    const result = await this.pool.query(
      `
            UPDATE blocks SET blocked_until = NOW() + make_interval(mins => $2)
            WHERE id_user = $1 RETURNING *`,
      [idUser, BLOCK_DURATION_MINUTES]
    );
    return result.rows[0] ? this.toEntity(result.rows[0]) : null;
  }

  async resetAttempts(idUser) {
    await this.pool.query(
      `
            UPDATE blocks SET failed_attempts = 0, blocked_until = NULL
            WHERE id_user = $1`,
      [idUser]
    );
  }

  toEntity(row) {
    return new Block(row.id_block, row.id_user, row.failed_attempts, row.blocked_until);
  }
}

module.exports = PostgresBlockRepository;
