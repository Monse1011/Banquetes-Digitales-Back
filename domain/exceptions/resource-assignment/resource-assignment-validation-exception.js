const { ResourceAssignmentMessages } = require("../../constants/resource-assignment-messages");

class ResourceAssignmentValidationException extends Error {
  constructor(errors) {
    super(ResourceAssignmentMessages.INVALID_DATA);
    this.name = "ResourceAssignmentValidationException";
    this.errors = errors;
  }
}

module.exports = ResourceAssignmentValidationException;
