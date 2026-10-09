/**
 * saveProvisional y confirm solo guardan si las asignaciones que bloquean esos recursos siguen
 * siendo las leídas con findBlocking; si otra operación las cambió, devuelven null.
 *
 * @typedef {Object} ResourceAssignmentRepository
 * @property {(requestId: number) => Promise<ResourceAssignment[]>} findByRequest provisionales y
 * confirmadas
 * @property {(resourceIds: number[], period: {start: Date, end: Date}, excludeRequestId: number) =>
 * Promise<ResourceAssignment[]>} findBlocking de otras solicitudes, traslapadas con el periodo
 * @property {(assignments: ResourceAssignment[], blocking: ResourceAssignment[]) =>
 * Promise<ResourceAssignment[] | null>} saveProvisional reemplaza las provisionales previas
 * @property {(assignments: ResourceAssignment[], releasedIds: number[],
 * blocking: ResourceAssignment[]) => Promise<ResourceAssignment[] | null>} confirm
 * @property {(requestId: number) => Promise<ResourceAssignment[]>} releaseProvisional
 */

module.exports = {};
