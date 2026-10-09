const { CalendarMessages } = require("../../constants/calendar-messages");

// D.2 / D.4: la cancelación requiere confirmación explícita; sin ella no hay cambios.
class CancellationNotConfirmedException extends Error {
  constructor() {
    super(CalendarMessages.CANCEL_CONFIRMATION);
    this.name = "CancellationNotConfirmedException";
  }
}

module.exports = CancellationNotConfirmedException;
