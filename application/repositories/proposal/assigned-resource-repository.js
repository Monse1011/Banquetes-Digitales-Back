/**
 * Contrato del repositorio de asignaciones de recursos (DAD 010 §7.4).
 * @typedef {Object} AssignedResourceRepository
 * @property {(requestId: number) => Promise<Array>} findActiveByRequestId
 * @property {(resourceIds: Array<number>, start: Date, end: Date,
 *   excludeRequestId: number) => Promise<Array>} findAvailability
 * @property {(requestId: number, adjustments: Array<{resourceId: number,
 *   quantity: number}>, usageStart: Date, usageEnd: Date) => Promise<void>}
 *   syncAssignments
 */

module.exports = {};
