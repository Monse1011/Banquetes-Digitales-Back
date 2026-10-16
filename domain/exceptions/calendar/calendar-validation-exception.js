class CalendarValidationException extends Error {
  constructor(errors, message = "Los datos del evento no son válidos") {
    super(message);
    this.name = "CalendarValidationException";
    this.errors = errors;
  }
}

module.exports = CalendarValidationException;
