/**
 * @typedef {Object} OperativeRoleRepository
 * @property {() => Promise<OperativeRole[]>} findActive
 * @property {(id: number) => Promise<OperativeRole | null>} findById
 * @property {(ids: number[]) => Promise<OperativeRole[]>} findByIds en una sola consulta; omite
 * los que no existen
 * @property {(role: OperativeRole) => Promise<OperativeRole>} create
 * @property {(name: string, excludeId?: number) => Promise<boolean>} existsByName
 * @property {(role: OperativeRole) => Promise<OperativeRole | null>} update
 * @property {(id: number) => Promise<OperativeRole | null>} deactivate
 */

module.exports = {};
