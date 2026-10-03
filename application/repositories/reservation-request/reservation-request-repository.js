/**
 * @typedef {Object} ReservationRequestRepository
 * @property {(request: ReservationRequest) => Promise<ReservationRequest>} create
 * @property {(id: number) => Promise<ReservationRequest | null>} findById
 * @property {(request: ReservationRequest) => Promise<ReservationRequest>} update
 * @property {(filters, sort, page, perPage) =>
 * Promise<{requests: ReservationRequest[], totalRecords: number}>} findAll
 * @property {(requestId: number, logisticUserId: number, assignedByUserId: number) =>
 * Promise<{status: string, conflicts?: Array<{folio: string, startDateTime: Date,
 * endDateTime: Date}>}>} assign
 */

module.exports = {};
