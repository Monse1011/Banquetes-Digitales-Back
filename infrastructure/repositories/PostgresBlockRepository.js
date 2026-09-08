const pool = require('../database/database');
const Block = require('../../domain/entities/Block');

class PostgresBlockRepository {
    async findByUserId(idUser) {
        const result = await pool.query(`
            SELECT id_block, id_user, failed_attempts, blocked_until
            FROM blocks WHERE id_user = $1`, [idUser]);
        return result.rows[0] ? new Block(result.rows[0]) : null;
    }

    async incrementFailedAttempts(idUser) {
        const result = await pool.query(`
            INSERT INTO blocks (id_user, failed_attempts)
            VALUES ($1, 1)
            ON CONFLICT (id_user)
            DO UPDATE SET failed_attempts = blocks.failed_attempts + 1
            RETURNING *`, [idUser]);
        return new Block(result.rows[0]);
    }

    async blockUser(idUser) {
        const result = await pool.query(`
            UPDATE blocks SET blocked_until = NOW() + INTERVAL '15 minutes'
            WHERE id_user = $1 RETURNING *`, [idUser]);
        return result.rows[0] ? new Block(result.rows[0]) : null;
    }

    async resetAttempts(idUser) {
        await pool.query(`
            UPDATE blocks SET failed_attempts = 0, blocked_until = NULL
            WHERE id_user = $1`, [idUser]);
    }
}
module.exports = PostgresBlockRepository;
