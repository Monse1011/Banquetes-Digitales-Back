// AD-09 (011-PIB): recurso inexistente o sin resultados exportables (RF-1.2.15.8);
// el manejador global la responde como 404 { message }.
class NotFoundException extends Error {
  constructor(message = "No se encontró el recurso solicitado.") {
    super(message);
    this.name = "NotFoundException";
    this.status = 404;
  }
}

module.exports = NotFoundException;
