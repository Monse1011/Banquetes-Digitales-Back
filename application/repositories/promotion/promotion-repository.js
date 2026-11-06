/**
 * @typedef {Object} PromotionRepository
 * @property {Function} findAllNotDeleted
 * @property {Function} findAllActive
 * @property {(id: number) => Promise<Promotion|null>} findById
 * @property {Function} checkDuplicateActiveName
 * @property {Function} checkDuplicateActiveNameExcludeId
 * @property {Function} create
 * @property {Function} update
 * @property {(id: number, status: string) => Promise<Promotion>} updateStatus
 * @property {(id: number, currentDate: string) => Promise<Promotion>} softDelete
 * @property {(currentDate: string) => Promise<number>} expireOutdatedPromotions
 */

module.exports = {};

