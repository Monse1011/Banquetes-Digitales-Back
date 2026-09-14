/**
 * @typedef {Object} PasswordResetRepository
 * @property {(userId: number, token: string, expirationDate: Date) =>
 * Promise<PasswordResetToken>} create
 * @property {(token: string) => Promise<PasswordResetToken | null>} findValidToken
 * @property {(tokenId: number) => Promise<void>} markAsUsed
 * @property {(userId: number) => Promise<void>} invalidateUserTokens
 */

module.exports = {};
