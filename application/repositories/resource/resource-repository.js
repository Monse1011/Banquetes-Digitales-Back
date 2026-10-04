/**
 * @typedef {Object} ResourceRepository
 * @property {(resource: Resource) => Promise<Resource>} create
 * @property {(id: number) => Promise<Resource | null>} findById
 * @property {(resource: Resource) => Promise<Resource>} update
 * @property {(filters: {type: string, isActive: boolean, name?: string, operativeRoleId?: number},
 * sort: {field: string, direction: 'asc' | 'desc'}, page: number, perPage: number) =>
 * Promise<{resources: Resource[], totalRecords: number}>} findAll
 * @property {(type: string, name: string, operativeRoleId: number | null) =>
 * Promise<boolean>} existsActiveByNameAndRole
 */

module.exports = {};
