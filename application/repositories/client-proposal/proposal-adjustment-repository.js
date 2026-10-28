/**
 * Incremento 3 (RF-3.4.4.5.6): contrato del repositorio de solicitudes de ajustes.
 * @typedef {Object} ProposalAdjustmentRepository
 * @property {(adjustment: ProposalAdjustment, transaction: Object|null) =>
 *   Promise<ProposalAdjustment>} create
 * @property {(requestId: number, transaction: Object|null) =>
 *   Promise<ProposalAdjustment[]>} findByRequestId
 *   Ordenadas de la más reciente a la más antigua.
 */

module.exports = {};
