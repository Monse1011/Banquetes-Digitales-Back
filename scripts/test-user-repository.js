const PostgresUserRepository = require('../infrastructure/repositories/PostgresUserRepository');

async function test() {
    try {
        const userRepository = new PostgresUserRepository();
        const user = await userRepository.findByEmployeeId('22216345');
        console.log('Usuario encontrado:');
        console.log(user);
    } catch (error) {
        console.error('Error:', error);
    }
}

test();
