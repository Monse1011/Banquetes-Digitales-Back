const {
  SaveAgreementsRequestDto,
} = require("../../../application/dto/proposal/save-agreements-request-dto");

// Función 3.4 - Contacto con el cliente: formulario de acuerdos.
class AgreementsController {
  constructor(dependencies) {
    this.dependencies = dependencies;
  }

  // RF-2.3.4.1 / RF-2.3.4.2: precarga del formulario con los datos previos.
  async getRequestAgreements(request, response) {
    const result = await this.dependencies.getRequestAgreementsUseCase.execute(
      this.parseId(request.params.id),
      request.user.id_user
    );

    response.json(result);
  }

  // RF-2.3.4.11: "Guardar acuerdos" registra sin cambiar el estado.
  async saveAgreements(request, response) {
    const dto = new SaveAgreementsRequestDto(request.body?.data ?? {});
    const result = await this.dependencies.saveAgreementsUseCase.execute(
      this.parseId(request.params.id),
      request.user.id_user,
      dto
    );

    response.status(201).json(result);
  }

  parseId(value) {
    const id = Number(typeof value === "string" ? value : NaN);

    if (!Number.isInteger(id) || id < 1) {
      throw new Error("Invalid reservation request id");
    }

    return id;
  }
}

module.exports = { AgreementsController };
