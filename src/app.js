const express = require('express');
const pool = require('./config/database');

const authRoutes = require('./routes/authRoutes');
const testRoutes = require('./routes/testRoutes');

const passwordResetRoutes = require('./routes/passwordResetRoutes');

const app = express();

app.use(express.json());

app.get('/api/health', async (req, res) => {

    try {

        const result = await pool.query('SELECT NOW()');

        res.json({
            status: 'ok',
            database: 'connected',
            time: result.rows[0].now
        });

    } catch (error) {

        console.error(
            'Error al conectar con PostgreSQL:',
            error
        );

        res.status(500).json({
            status: 'error',
            database: 'disconnected'
        });
    }
});

app.use('/api/auth', authRoutes);
app.use('/api/test', testRoutes);

app.use(
    '/api/auth',
    passwordResetRoutes
);

module.exports = app;