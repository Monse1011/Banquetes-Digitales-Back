class OperativeRoleValidationException extends Error {
  constructor(errors) {
    super("El rol operativo contiene datos inválidos");
    this.name = "OperativeRoleValidationException";
    this.errors = errors;
  }
}

module.exports = OperativeRoleValidationException;
