require('dotenv').config();
const JwtTokenService = require('../infrastructure/security/JwtTokenService');
const User = require('../domain/entities/User');
const Password = require('../domain/value-objects/Password');

function test() {
    if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) {
        throw new Error('JWT_SECRET debe existir y tener al menos 32 caracteres');
    }

    const user = new User({
        id_user: 1,
        id_employee: '22216345',
        full_name: 'Usuario de Prueba',
        email: 'admin@test.com',
        role: 'admin',
        status: 'activo',
        last_access: new Date()
    });

    const tokenService = new JwtTokenService();
    const token = tokenService.generateToken(user);
    const decoded = tokenService.verifyToken(token);
    const password = Password.validate('Admin123!');

    console.log('Arquitectura verificada:');
    console.log({
        tokenGenerated: Boolean(token),
        decodedRole: decoded.role,
        passwordPolicyValid: password.valid
    });
}

test();
