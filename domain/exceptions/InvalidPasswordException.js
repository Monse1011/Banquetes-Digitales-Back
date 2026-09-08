class InvalidPasswordException extends Error {
    constructor(message) { super(message); this.name = 'InvalidPasswordException'; }
}
module.exports = InvalidPasswordException;
