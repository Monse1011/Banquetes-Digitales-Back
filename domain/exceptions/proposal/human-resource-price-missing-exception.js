// Defecto 4: no se cotiza con costo 0 en silencio a una persona sin precio por hora.
class HumanResourcePriceMissingException extends Error {
  constructor(resources) {
    const names = resources.map((resource) => resource.name).join(", ");

    const verb = resources.length === 1 ? "no tiene" : "no tienen";

    super(
      `No se puede generar la propuesta: ${names} ${verb} precio por hora. ` +
        "Asigna un precio por hora antes de continuar."
    );
    this.name = "HumanResourcePriceMissingException";
    this.errors = { adjusted_resources: this.message };
    this.resources = resources.map(({ resourceId, name }) => ({ resource_id: resourceId, name }));
  }
}

module.exports = HumanResourcePriceMissingException;
