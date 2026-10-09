/**
 * @typedef {Object} ResourceConfirmationRepository
 * @property {(confirmation: ResourceConfirmation) => Promise<ResourceConfirmation>} create
 * @property {(requestId: number) => Promise<ResourceConfirmation | null>} findLatestByRequest
 * @property {(requestId: number, observations: string | null) => Promise<void>}
 * savePendingObservations
 * @property {(requestId: number) => Promise<string | null>} findPendingObservations
 * @property {(requestId: number) => Promise<void>} deletePendingObservations
 */

module.exports = {};
