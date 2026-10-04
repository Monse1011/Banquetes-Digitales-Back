/**
 * @typedef {Object} ResourceRepository
 * @property {(resource: Resource) => Promise<Resource>} create
 * @property {(id: number) => Promise<Resource | null>} findById
 * @property {(resource: Resource) => Promise<Resource>} update
 * @property {(filters: {type?: string, isActive: boolean, name?: string, operativeRoleId?: number},
 * sort: {field: string, direction: 'asc' | 'desc'}, page: number, perPage: number) =>
 * Promise<{resources: Resource[], totalRecords: number}>} findAll
 * @property {(type: string, name: string,
 * options?: {operativeRoleId?: number | null, activeOnly?: boolean, excludeId?: number}) =>
 * Promise<boolean>} existsByName nombre comparado sin distinguir mayúsculas ni espacios extremos
 */

module.exports = {};
