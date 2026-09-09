class InvalidCredentialsException extends Error {
    constructor() { super('Credenciales incorrectas'); this.name = 'InvalidCredentialsException'; }
}
module.exports = InvalidCredentialsException;
