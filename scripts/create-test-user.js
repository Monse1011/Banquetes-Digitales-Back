require('dotenv').config();
const bcrypt = require('bcrypt');
const pool = require('../infrastructure/database/database');

async function createUser() {
    try {
        const password = 'User123!';
        const passwordHash = await bcrypt.hash(password, 10);
        const result = await pool.query(`
            INSERT INTO users (id_employee, full_name, email, password_hash, role)
            VALUES ($1, $2, $3, $4, $5)
            RETURNING id_user, id_employee, full_name, email, role`,
            ['22216361', 'Usuario de Prueba 3', 'aguilarmorenoashleyshaden07@gmail.com', passwordHash, 'logistica']
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
