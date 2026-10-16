/**
 * Contrato del repositorio de información derivada (DAD 010 §7.2).
 * @typedef {Object} DerivedInformationRepository
 * @property {(information: Object) =>
 *   Promise<Object>} create
 * @property {(id: number, requestId: number) => Promise<Object|null>} findByIdAndRequestId
 */

module.exports = {};
