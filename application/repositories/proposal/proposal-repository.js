/**
 * Contrato del repositorio de propuestas (DAD 010 §7.3).
 * @typedef {Object} ProposalRepository
 * @property {(proposal: Object, requestId: number, expectedStatuses: Array<string>) =>
 *   Promise<Object|null>} createWithRequestStatus
 * @property {(requestId: number) => Promise<Object|null>} findByRequestId
 */

module.exports = {};
