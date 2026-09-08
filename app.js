const express = require('express');
const pool = require('./infrastructure/database/database');
const PostgresUserRepository = require('./infrastructure/repositories/PostgresUserRepository');
const PostgresBlockRepository = require('./infrastructure/repositories/PostgresBlockRepository');
const PostgresPasswordResetRepository = require('./infrastructure/repositories/PostgresPasswordResetRepository');
const JwtTokenService = require('./infrastructure/security/JwtTokenService');
const NodemailerEmailService = require('./infrastructure/email/NodemailerEmailService');
const BlockService = require('./application/use-cases/BlockService');
const AuthenticateUser = require('./application/use-cases/AuthenticateUser');
const ChangePassword = require('./application/use-cases/ChangePassword');
const RequestPasswordReset = require('./application/use-cases/RequestPasswordReset');
const ResetPassword = require('./application/use-cases/ResetPassword');
const AuthController = require('./presentation/controller/AuthController');
const PasswordResetController = require('./presentation/controller/PasswordResetController');
const createAuthMiddleware = require('./middleware/authMiddleware');
const createAuthRoutes = require('./routes/authRoutes');
const createPasswordResetRoutes = require('./routes/passwordResetRoutes');
const createTestRoutes = require('./routes/testRoutes');
const createRateLimit = require('./middleware/rateLimit');

if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) {
    throw new Error('JWT_SECRET debe existir y tener al menos 32 caracteres');
}

const userRepository = new PostgresUserRepository();
const blockRepository = new PostgresBlockRepository();
const passwordResetRepository = new PostgresPasswordResetRepository();
const tokenService = new JwtTokenService();
const emailService = new NodemailerEmailService();
const blockService = new BlockService(blockRepository);

const authenticateUser = new AuthenticateUser(userRepository, blockService, tokenService);
const changePassword = new ChangePassword(userRepository, blockService, tokenService);
const requestPasswordReset = new RequestPasswordReset(userRepository, passwordResetRepository, emailService);
const resetPassword = new ResetPassword(userRepository, passwordResetRepository, tokenService);

const authController = new AuthController(authenticateUser, changePassword);
const passwordResetController = new PasswordResetController(requestPasswordReset, resetPassword);
const authMiddleware = createAuthMiddleware(tokenService);

const authRateLimit = createRateLimit({
    windowMs: 5 * 60 * 1000,
    max: 10,
    message: 'Demasiadas solicitudes. Intenta nuevamente más tarde.'
});

const resetRateLimit = createRateLimit({
    windowMs: 5 * 60 * 1000,
    max: 10,
    message: 'Demasiadas solicitudes. Intenta nuevamente más tarde.'
});

const app = express();
app.use(express.json());

app.get('/api/health', async (req, res) => {
    try {
        const result = await pool.query('SELECT NOW()');
        res.json({ status: 'ok', database: 'connected', time: result.rows[0].now });
    } catch (error) {
        console.error('Error al conectar con PostgreSQL:', error.message);
        res.status(500).json({ status: 'error', database: 'disconnected' });
    }
});

app.use('/api/auth', authRateLimit, createAuthRoutes(authController, authMiddleware));
app.use('/api/auth', resetRateLimit, createPasswordResetRoutes(passwordResetController));

app.use('/api/test', createTestRoutes(authMiddleware));

module.exports = app;
