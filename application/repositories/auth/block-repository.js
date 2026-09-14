/**
 * @typedef {Object} BlockRepository
 * @property {(userId: number) => Promise<Block | null>} findByUserId
 * @property {(userId: number) => Promise<Block>} incrementFailedAttempts
 * @property {(userId: number) => Promise<Block | null>} blockUser
 * @property {(userId: number) => Promise<void>} resetAttempts
 */

module.exports = {};
