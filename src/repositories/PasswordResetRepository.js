const pool = require('../config/database');

class PasswordResetRepository {

    async create(idUser, token, expirationDate) {

        const result = await pool.query(
            `INSERT INTO password_reset_tokens (
                id_user,
                token,
                expiration_date
            )
            VALUES ($1, $2, $3)
             RETURNING *`,
            [
                idUser,
                token,
                expirationDate
            ]
        );

        return result.rows[0];
    }

    async findValidToken(token) {

        const result = await pool.query(
            `SELECT
                prt.id_token,
                prt.id_user,
                prt.token,
                prt.expiration_date,
                prt.used,
                u.id_employee,
                u.full_name,
                u.email,
                u.role,
                u.status
            FROM password_reset_tokens prt
            INNER JOIN users u
                ON u.id_user = prt.id_user
            WHERE prt.token = $1
            AND prt.used = FALSE
            AND prt.expiration_date > NOW()`,
            [token]
        );

        return result.rows[0] || null;
    }

    async markAsUsed(idToken) {

        await pool.query(
            `UPDATE password_reset_tokens
            SET used = TRUE
            WHERE id_token = $1`,
            [idToken]
        );
    }

    async invalidateUserTokens(idUser) {

        await pool.query(
            `UPDATE password_reset_tokens
            SET used = TRUE
            WHERE id_user = $1
            AND used = FALSE`,
            [idUser]
        );
    }
}

module.exports = PasswordResetRepository;