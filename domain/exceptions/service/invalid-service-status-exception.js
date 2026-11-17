const { ServiceMessages } = require("../../constants/service-messages");

class InvalidServiceStatusException extends Error {
  constructor(message = ServiceMessages.INVALID_STATUS) {
    super(message);
    this.name = "InvalidServiceStatusException";
    this.status = 422;
  }
}

module.exports = InvalidServiceStatusException;

