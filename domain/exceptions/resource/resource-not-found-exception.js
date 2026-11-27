class ResourceNotFoundException extends Error {
  constructor(message = "El recurso no existe.") {
    super(message);
    this.name = "ResourceNotFoundException";
  }
}

module.exports = ResourceNotFoundException;
