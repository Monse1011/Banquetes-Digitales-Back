/**
 * saveProvisional y confirm solo guardan si las asignaciones que bloquean esos recursos siguen
 * siendo las leídas con findBlocking; si otra operación las cambió, devuelven null. Las
 * escrituras reciben opcionalmente la transacción en la que se ejecutan.
 *
 * @typedef {Object} ResourceAssignmentRepository
 * @property {(requestId: number) => Promise<ResourceAssignment[]>} findByRequest provisionales y
 * confirmadas
 * @property {(resourceIds: number[], period: {start: Date, end: Date}, excludeRequestId: number) =>
 * Promise<ResourceAssignment[]>} findBlocking de otras solicitudes, traslapadas con el periodo
 * @property {(assignments: ResourceAssignment[], blocking: ResourceAssignment[],
 * transaction?: Transaction) => Promise<ResourceAssignment[] | null>} saveProvisional reemplaza
 * las provisionales previas
 * @property {(assignments: ResourceAssignment[], releasedIds: number[],
 * blocking: ResourceAssignment[], transaction?: Transaction) =>
 * Promise<ResourceAssignment[] | null>} confirm
 * @property {(requestId: number, transaction?: Transaction) => Promise<ResourceAssignment[]>}
 * releaseProvisional
 * @property {(requestId: number, resourceId: number, transaction?: Transaction) =>
 * Promise<ResourceAssignment | null>} releaseProvisionalResource null si el recurso no tiene
 * asignación provisional en la solicitud
 */

module.exports = {};
