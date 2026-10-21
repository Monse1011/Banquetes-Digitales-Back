/**
 * @typedef {Object} OperativeRoleRepository
 * @property {() => Promise<OperativeRole[]>} findActive
 * @property {(id: number) => Promise<OperativeRole | null>} findById
 * @property {(ids: number[]) => Promise<OperativeRole[]>} findByIds en una sola consulta; omite
 * los que no existen
 */

module.exports = {};
