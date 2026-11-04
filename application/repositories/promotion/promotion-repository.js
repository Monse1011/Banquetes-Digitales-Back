/**
 * @typedef {Object} PromotionRepository
 * @property {({ page, per_page, currentDate }: { page: number, per_page: number, currentDate: string }) => Promise<{ promotions: Promotion[], total_records: number }>} findAllNotDeleted
 * @property {({ page, per_page, currentDate }: { page: number, per_page: number, currentDate: string }) => Promise<{ promotions: Promotion[], total_records: number }>} findAllActive
 * @property {(id: number) => Promise<Promotion|null>} findById
 * @property {(name: string, currentDate: string) => Promise<boolean>} checkDuplicateActiveName
 * @property {(name: string, id: number, currentDate: string) => Promise<boolean>} checkDuplicateActiveNameExcludeId
 * @property {(data: { name: string, description: string, discount_percentage: number, valid_until: string, status?: string }) => Promise<Promotion>} create
 * @property {(id: number, data: { name: string, description: string, discount_percentage: number, valid_until: string }) => Promise<Promotion>} update
 * @property {(id: number, status: string) => Promise<Promotion>} updateStatus
 * @property {(id: number, currentDate: string) => Promise<Promotion>} softDelete
 * @property {(currentDate: string) => Promise<number>} expireOutdatedPromotions
 */

module.exports = {};

