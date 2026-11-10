/**
 * Contrato del catálogo de promociones que consume la Función 4.1 (contrato 11).
 * La gestión (contratos 6 a 10) pertenece a la Función 2.7 y no se entrega aquí.
 *
 * @typedef {Object} PromotionRepository
 * @property {() => Promise<number>} expireOutdated UPDATE idempotente que marca INACTIVE
 *   las ACTIVE con valid_until anterior a la fecha actual de Mérida (RF-1.2.7.5/7.7, AD-06).
 * @property {() => Promise<Array<{id: number, name: string, description: string,
 *   discount_percentage: number, valid_until: string}>>} listActiveForPortal solo ACTIVE y
 *   vigentes hoy, orden name, id (RF-3.4.1.2.2).
 */

module.exports = {};
