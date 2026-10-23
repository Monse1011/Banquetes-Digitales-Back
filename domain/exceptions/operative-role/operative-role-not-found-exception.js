const { OperativeRoleMessages } = require("../../constants/operative-role-messages");

class OperativeRoleNotFoundException extends Error {
  constructor(message = OperativeRoleMessages.NOT_FOUND) {
    super(message);
    this.name = "OperativeRoleNotFoundException";
  }
}

module.exports = OperativeRoleNotFoundException;
