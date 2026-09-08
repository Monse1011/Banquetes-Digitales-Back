const pool = require('../config/database');

class UserRepository {

    async findByEmployeeId(idEmployee) {
        const result = await pool.query(
            `SELECT
                id_user,
                id_employee,
                full_name,
                email,
                password_hash,
                role,
                status,
                creation_date,
                last_access
            FROM users
            WHERE id_employee = $1`,
            [idEmployee]
        );

        return result.rows[0] || null;
    }

    async updateLastAccess(idUser) {
        await pool.query(
            `UPDATE users
            SET last_access = NOW()
            WHERE id_user = $1`,
            [idUser]
        );
    }

    async updatePassword(idUser, passwordHash) {
        await pool.query(
            `UPDATE users
            SET password_hash = $1,
                last_access = NOW()
            WHERE id_user = $2`,
            [passwordHash, idUser]
        );
    }

    async findByEmail(email) {

        const result = await pool.query(
            `SELECT
                id_user,
                id_employee,
                full_name,
                email,
                password_hash,
                role,
                status,
                creation_date,
                last_access
            FROM users
            WHERE email = $1`,
            [email]
        );

        return result.rows[0] || null;
    }
}

module.exports = UserRepository;