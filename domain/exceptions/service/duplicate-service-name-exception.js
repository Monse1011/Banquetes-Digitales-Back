const { ServiceMessages } = require("../../constants/service-messages");

class DuplicateServiceNameException extends Error {
  constructor(message = ServiceMessages.DUPLICATE_NAME) {
    super(message);
    this.name = "DuplicateServiceNameException";
    this.status = 409;
  }
}

module.exports = DuplicateServiceNameException;

