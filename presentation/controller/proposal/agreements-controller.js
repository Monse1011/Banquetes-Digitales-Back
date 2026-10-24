const {
  SaveAgreementsRequestDto,
} = require("../../../application/dto/proposal/save-agreements-request-dto");
const { parseId } = require("../../utils/parse-id");

// Función 3.4 - Contacto con el cliente: formulario de acuerdos.
class AgreementsController {
  constructor(dependencies) {
    this.dependencies = dependencies;
  }

  // RF-2.3.4.1 / RF-2.3.4.2: precarga del formulario con los datos previos.
  async getRequestAgreements(request, response) {
    const result = await this.dependencies.getRequestAgreementsUseCase.execute(
      parseId(request.params.id),
      request.user.id_user,
      request.user.role
    );

    response.json(result);
  }

  // RF-2.3.4.11: "Guardar acuerdos" registra sin cambiar el estado.
  async saveAgreements(request, response) {
    const dto = new SaveAgreementsRequestDto(request.body?.data ?? {});
    const result = await this.dependencies.saveAgreementsUseCase.execute(
      parseId(request.params.id),
      request.user.id_user,
      dto,
      request.user.role
    );

    response.status(201).json(result);
  }
}

module.exports = { AgreementsController };
