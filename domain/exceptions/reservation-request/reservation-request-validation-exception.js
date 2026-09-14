class ReservationRequestValidationException extends Error {
  constructor(errors) {
    super("La solicitud de reservación contiene datos inválidos");
    this.name = "ReservationRequestValidationException";
    this.errors = errors;
  }
}

module.exports = ReservationRequestValidationException;
