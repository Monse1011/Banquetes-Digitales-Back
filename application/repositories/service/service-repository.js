/**
 * @typedef {Object} ServiceRepository
 * @property {() => Promise<Service[]>} findAll
 * @property {(ids: number[]) => Promise<Service[]>} findByIds
 * @property {({ page, per_page }: { page: number, per_page: number }) => Promise<{ services: Service[], total_records: number }>} findAllNotDeleted
 * @property {(id: number) => Promise<Service|null>} findById
 * @property {(name: string) => Promise<boolean>} checkDuplicateActiveName
 * @property {(name: string, id: number) => Promise<boolean>} checkDuplicateActiveNameExcludeId
 * @property {(data: { name: string, description: string, price: number, status?: string }) => Promise<Service>} create
 * @property {(id: number, data: { name: string, description: string, price: number }) => Promise<Service>} update
 * @property {(id: number, status: string) => Promise<Service>} updateStatus
 * @property {(id: number) => Promise<Service>} softDelete
 */

module.exports = {};
