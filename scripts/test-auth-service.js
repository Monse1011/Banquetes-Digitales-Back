require('dotenv').config();
const PostgresUserRepository = require('../infrastructure/repositories/PostgresUserRepository');
const PostgresBlockRepository = require('../infrastructure/repositories/PostgresBlockRepository');
const JwtTokenService = require('../infrastructure/security/JwtTokenService');
const BlockService = require('../application/use-cases/BlockService');
const AuthenticateUser = require('../application/use-cases/AuthenticateUser');

async function test() {
    try {
        if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) {
            throw new Error('JWT_SECRET debe existir y tener al menos 32 caracteres');
        }
        const userRepository = new PostgresUserRepository();
        const blockRepository = new PostgresBlockRepository();
        const tokenService = new JwtTokenService();
        const blockService = new BlockService(blockRepository);
        const authenticateUser = new AuthenticateUser(userRepository, blockService, tokenService);

        const result = await authenticateUser.execute('22216345', 'Admin123!');
        console.log('Login correcto:');
        console.log({
            id_employee: result.user.id_employee,
            full_name: result.user.full_name,
            role: result.user.role,
            requiresPasswordChange: result.requiresPasswordChange,
            tokenGenerated: Boolean(result.token)
        });
    } catch (error) {
        console.error('Login rechazado:', error.message);
    }
}

test();
