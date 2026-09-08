const AuthService = require('../src/services/AuthService');

async function test() {
    const authService = new AuthService();

    try {
        const result = await authService.authenticate(
            '22216345',
            'Admin123!'
        );

        console.log('Login correcto:');
        console.log({
            id_employee: result.user.id_employee,
            full_name: result.user.full_name,
            role: result.user.role,
            requiresPasswordChange: result.requiresPasswordChange
        });

    } catch (error) {
        console.error('Login rechazado:', error.message);
    }
}

test();