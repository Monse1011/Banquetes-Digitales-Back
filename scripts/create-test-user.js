const bcrypt = require('bcrypt');
const pool = require('../src/config/database');

async function createUser() {
    try {
        const password = 'Admin123!';
        const passwordHash = await bcrypt.hash(password, 10);

        const result = await pool.query(
            `INSERT INTO users
                (id_employee, full_name, email, password_hash, role)
            VALUES
                ($1, $2, $3, $4, $5)
            RETURNING id_user, id_employee, full_name, email, role`,
            [
                '22216345',
                'Usuario de Prueba',
                'admin@test.com',
                passwordHash,
                'admin'
            ]
        );

        console.log('Usuario creado:');
        console.log(result.rows[0]);

    } catch (error) {
        console.error('Error creando usuario:', error);
    } finally {
        await pool.end();
    }
}

createUser();