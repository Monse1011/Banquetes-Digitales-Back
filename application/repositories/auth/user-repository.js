/**
 * @typedef {Object} UserRepository
 * @property {(employeeId: string) => Promise<User | null>} findByEmployeeId
 * @property {(email: string) => Promise<User | null>} findByEmail
 * @property {(userId: number) => Promise<User | null>} findById
 * @property {(userId: number) => Promise<void>} updateLastAccess
 * @property {(userId: number, passwordHash: string) => Promise<void>} updatePassword
 */

module.exports = {};
