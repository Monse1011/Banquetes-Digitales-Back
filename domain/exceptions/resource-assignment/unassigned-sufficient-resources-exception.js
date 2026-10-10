// RF-2.3.2.20: no se puede finalizar con recursos "Suficiente" sin asignar.
class UnassignedSufficientResourcesException extends Error {
  constructor(
    message = "Debe asignar todos los recursos con estado Suficiente antes de finalizar la confirmación."
  ) {
    super(message);
    this.name = "UnassignedSufficientResourcesException";
  }
}

module.exports = UnassignedSufficientResourcesException;
