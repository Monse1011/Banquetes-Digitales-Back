// El recurso cambió entre su lectura y el guardado de otra operación (control optimista).
class ResourceConcurrencyException extends Error {
  constructor(
    message = "El recurso fue modificado por otra operación. Recargue la información e intente de nuevo."
  ) {
    super(message);
    this.name = "ResourceConcurrencyException";
  }
}

module.exports = ResourceConcurrencyException;
