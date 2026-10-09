const { CalendarMessages } = require("../../constants/calendar-messages");

// El usuario autenticado no puede operar sobre el evento (E.2 / E.7).
class CalendarAccessDeniedException extends Error {
  constructor() {
    super(CalendarMessages.ACCESS_DENIED);
    this.name = "CalendarAccessDeniedException";
  }
}

module.exports = CalendarAccessDeniedException;
