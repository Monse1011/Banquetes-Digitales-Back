/**
 * Consultas de solo lectura de GET /api/admin/requests (Funciones 2.4, 2.5 y 2.11). Devuelven los
 * datos con la forma del contrato del DAD v3.0 (snake_case, DateTime con offset -06:00).
 *
 * @typedef {Object} AdminRequestFilters
 * @property {string[]|null} [statuses] valores de ReservationRequestStatus
 * @property {string|null} [search] coincidencia parcial con folio o nombre del cliente
 * @property {number|null} [logisticUserId]
 * @property {string|null} [eventDateFrom] fecha vigente mínima (YYYY-MM-DD)
 * @property {string|null} [eventDateTo] fecha vigente máxima (YYYY-MM-DD)
 *
 * @typedef {Object} AdminRequestQueryRepository
 * @property {(filters: AdminRequestFilters, page: number, perPage: number) =>
 * Promise<{requests: Object[], totalRecords: number}>} findAll ordenado por inicio vigente y folio
 * @property {(id: number) => Promise<{request: Object, currentStart: Date, currentEnd: Date|null,
 * assignments: Object[]}|null>} findById
 * @property {(resourceIds: number[], excludeRequestId: number) => Promise<Object[]>}
 * findBlockingAssignments asignaciones no liberadas de otras solicitudes
 */

module.exports = {};
