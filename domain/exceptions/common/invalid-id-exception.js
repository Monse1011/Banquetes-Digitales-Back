// Estándares de Código 2.4: excepción personalizada para identificadores de URL
// inválidos; el manejador global la responde como error de validación (400).
class InvalidIdException extends Error {
  constructor(message = "El identificador proporcionado no es válido.") {
    super(message);
    this.name = "InvalidIdException";
  }
}

module.exports = InvalidIdException;
