/**
 * @typedef {Object} ServiceRepository
 * @property {Function} findAll
 * @property {Function} findByIds
 * @property {Function} findAllNotDeleted
 * @property {(id: number) => Promise<Service|null>} findById
 * @property {(name: string) => Promise<boolean>} checkDuplicateActiveName
 * @property {(name: string, id: number) => Promise<boolean>} checkDuplicateActiveNameExcludeId
 * @property {Function} create
 * @property {Function} update
 * @property {(id: number, status: string) => Promise<Service>} updateStatus
 * @property {(id: number) => Promise<Service>} softDelete
 */

module.exports = {};
