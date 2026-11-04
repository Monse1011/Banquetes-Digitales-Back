const { ServiceMessages } = require("../../constants/service-messages");

class ServiceNotFoundException extends Error {
  constructor(message = ServiceMessages.NOT_FOUND) {
    super(message);
    this.name = "ServiceNotFoundException";
    this.status = 404;
  }
}

module.exports = ServiceNotFoundException;

