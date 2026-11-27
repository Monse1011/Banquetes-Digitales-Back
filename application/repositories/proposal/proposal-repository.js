/**
 * Contrato del repositorio de propuestas (DAD 010 §7.3).
 * @typedef {Object} ProposalRepository
 * @property {(proposal: Object, requestId: number, expectedStatuses: Array<string>,
 *   resources: Array, transaction: Object|null) => Promise<Object|null>} createWithRequestStatus
 * @property {(requestId: number) => Promise<Object|null>} findByRequestId
 * Incremento 3 (Función 4.4):
 * @property {(requestId: number, transaction: Object|null) => Promise<Object|null>}
 *   findCurrentByRequestId  — versión de mayor número (propuesta vigente).
 * @property {(proposalId: number, transaction: Object|null) => Promise<Array>}
 *   findResourcesByProposalId — líneas crudas {type, description, quantity, unitCost}.
 * @property {(proposalId: number, viewedAt: Date, transaction: Object|null) =>
 *   Promise<boolean>} markViewed — escribe viewed_at una sola vez.
 * @property {(proposalId: number, acceptedAt: Date, acceptedPdfPath: string,
 *   transaction: Object|null) => Promise<boolean>} markAccepted.
 * @property {(proposalId: number, expectedStatus: string, newStatus: string,
 *   transaction: Object|null) => Promise<boolean>} updateStatusAtomic.
 * @property {(requestId: number, transaction: Object|null) => Promise<number>} nextVersion.
 */

module.exports = {};
