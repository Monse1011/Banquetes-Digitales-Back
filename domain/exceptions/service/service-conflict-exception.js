const { ServiceMessages } = require("../../constants/service-messages");

class ServiceConflictException extends Error {
  constructor(message = ServiceMessages.STATUS_SAME) {
    super(message);
    this.name = "ServiceConflictException";
    this.status = 409;
  }
}

module.exports = ServiceConflictException;

