const ReservationRequestSortField = {
  ClientName: 'clientName',
  EventDate: 'eventDate',
  Status: 'status'
};

/**
 * @typedef {Object} ReservationRequestSort
 * @property {string} field
 * @property {'asc' | 'desc'} direction
 */

module.exports = { ReservationRequestSortField };
