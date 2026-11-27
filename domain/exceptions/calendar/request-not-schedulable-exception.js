const { CalendarMessages } = require("../../constants/calendar-messages");

// A.1: solo una solicitud en «Propuesta generada» puede agendarse.
class RequestNotSchedulableException extends Error {
  constructor() {
    super(CalendarMessages.REQUEST_NOT_SCHEDULABLE);
    this.name = "RequestNotSchedulableException";
  }
}

module.exports = RequestNotSchedulableException;
