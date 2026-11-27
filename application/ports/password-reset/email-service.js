/**
 * @typedef {Object} EmailService
 * @property {(email: string, fullName: string, token: string) =>
 * Promise<void>} sendPasswordResetEmail
 * @property {(credentials: {to: string, fullName: string, tempPassword: string}) =>
 * Promise<void>} sendCredentials
 */

module.exports = {};
