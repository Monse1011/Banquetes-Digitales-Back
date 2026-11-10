/**
 * Catálogo de promociones compartido por la gestión de la Función 2.7 (contratos 6 a 10)
 * y el catálogo público de la Función 4.1 (contrato 11).
 *
 * AD-06: el UPDATE de expiración (RF-1.2.7.5 / RF-1.2.7.7) tiene una sola implementación.
 * La gestión lo invoca con la fecha de Mérida que calcula PromotionsService
 * (expireOutdatedPromotions(currentDate)); el catálogo público lo invoca sin argumento
 * (expireOutdated()), que evalúa la fecha actual de Mérida en la base de datos.
 *
 * @typedef {Object} PromotionRepository
 * @property {(currentDate?: string) => Promise<number>} expireOutdatedPromotions
 *   UPDATE idempotente: marca INACTIVE las ACTIVE con valid_until anterior a currentDate.
 *   Sin argumento equivale a expireOutdated().
 * @property {() => Promise<number>} expireOutdated UPDATE idempotente con la fecha actual
 *   de Mérida evaluada por la base de datos (RF-1.2.7.5 / RF-1.2.7.7, AD-06).
 * @property {({ page: number, per_page: number, currentDate: string }) =>
 *   Promise<{ promotions: Promotion[], total_records: number }>} findAllNotDeleted
 *   catálogo de gestión (contrato 6): ACTIVE e INACTIVE, excluye DELETED, expira antes.
 * @property {({ page: number, per_page: number, currentDate: string }) =>
 *   Promise<{ promotions: Promotion[], total_records: number }>} findAllActive
 *   promociones vigentes paginadas por fecha de Mérida (RF-1.2.7.5).
 * @property {() => Promise<Array<{id: number, name: string, description: string,
 *   discount_percentage: number, valid_until: string}>>} listActiveForPortal
 *   catálogo público (contrato 11): solo ACTIVE y vigentes hoy, orden name, id
 *   (RF-3.4.1.2.2). Lo sirve ClientContentController; requiere expireOutdated() antes.
 * @property {(id: number) => Promise<Promotion|null>} findById
 * @property {(name: string, currentDate: string) => Promise<boolean>} checkDuplicateActiveName
 * @property {(name: string, id: number, currentDate: string) => Promise<boolean>}
 *   checkDuplicateActiveNameExcludeId
 * @property {(data: Object) => Promise<Promotion>} create
 * @property {(id: number, data: Object) => Promise<Promotion|null>} update
 * @property {(id: number, status: string) => Promise<Promotion|null>} updateStatus
 * @property {(id: number, currentDate: string) => Promise<Promotion|null>} softDelete
 */

module.exports = {};
