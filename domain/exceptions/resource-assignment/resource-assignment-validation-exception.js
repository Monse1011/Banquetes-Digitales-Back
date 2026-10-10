class ResourceAssignmentValidationException extends Error {
  constructor(errors) {
    super("La asignación de recursos contiene datos inválidos");
    this.name = "ResourceAssignmentValidationException";
    this.errors = errors;
  }
}

module.exports = ResourceAssignmentValidationException;
