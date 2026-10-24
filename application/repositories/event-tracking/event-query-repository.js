/**
 * Consultas de solo lectura de las Funciones 2.11 y 2.5. Devuelven los datos ya con la forma
 * del contrato API (snake_case, fechas y horas de America/Merida).
 *
 * @typedef {Object} EventFilters
 * @property {string[]} statuses estados de ReservationRequestStatus
 * @property {string|null} [search] coincidencia parcial con nombre del cliente o folio
 * @property {string|null} [from] fecha del evento mínima (YYYY-MM-DD)
 * @property {string|null} [to] fecha del evento máxima (YYYY-MM-DD)
 * @property {number|null} [logisticUserId]
 *
 * @typedef {Object} EventQueryRepository
 * @property {(filters: EventFilters, direction: "asc"|"desc", page: number, perPage: number) =>
 * Promise<{events: Object[], totalRecords: number}>} findAll ordenado por fecha y hora de inicio
 * programadas y luego por folio
 * @property {(id: number, statuses: string[]) => Promise<Object|null>} findById null si no existe
 * o no está en alguno de los estados indicados
 */

module.exports = {};
