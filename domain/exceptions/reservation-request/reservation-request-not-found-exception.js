class ReservationRequestNotFoundException extends Error {
  constructor() {
    super("Reservation request not found");
    this.name = "ReservationRequestNotFoundException";
  }
}

module.exports = ReservationRequestNotFoundException;
