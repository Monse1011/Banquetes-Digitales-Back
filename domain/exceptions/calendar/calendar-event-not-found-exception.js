const { CalendarMessages } = require("../../constants/calendar-messages");

class CalendarEventNotFoundException extends Error {
  constructor(message = CalendarMessages.EVENT_NOT_FOUND) {
    super(message);
    this.name = "CalendarEventNotFoundException";
  }
}

module.exports = CalendarEventNotFoundException;
