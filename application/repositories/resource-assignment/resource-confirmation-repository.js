/**
 * Las escrituras reciben opcionalmente la transacción en la que se ejecutan.
 *
 * @typedef {Object} ResourceConfirmationRepository
 * @property {(confirmation: ResourceConfirmation, transaction?: Transaction) =>
 * Promise<ResourceConfirmation>} create
 * @property {(requestId: number) => Promise<ResourceConfirmation | null>} findLatestByRequest
 * @property {(requestId: number, observations: string | null, transaction?: Transaction) =>
 * Promise<void>} savePendingObservations
 * @property {(requestId: number) => Promise<string | null>} findPendingObservations
 * @property {(requestId: number, transaction?: Transaction) => Promise<void>}
 * deletePendingObservations
 */

module.exports = {};
