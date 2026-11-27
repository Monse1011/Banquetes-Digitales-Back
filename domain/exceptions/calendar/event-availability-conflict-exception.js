const { CalendarMessages } = require("../../constants/calendar-messages");

// A.5 / C.4: el responsable o algún recurso no está disponible; `conflicts` los identifica.
class EventAvailabilityConflictException extends Error {
  constructor(message = CalendarMessages.SCHEDULE_UNAVAILABLE, conflicts = []) {
    super(message);
    this.name = "EventAvailabilityConflictException";
    this.conflicts = conflicts;
  }
}

module.exports = EventAvailabilityConflictException;
