class InvalidResetTokenException extends Error {
    constructor() { super('El enlace de restablecimiento no es válido o ha expirado'); this.name = 'InvalidResetTokenException'; }
}
module.exports = InvalidResetTokenException;
