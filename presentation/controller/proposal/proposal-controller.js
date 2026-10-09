const {
  GenerateProposalRequestDto,
} = require("../../../application/dto/proposal/generate-proposal-request-dto");

// Función 3.4 - Contacto con el cliente: generación y gestión de la propuesta.
class ProposalController {
  constructor(dependencies) {
    this.dependencies = dependencies;
  }

  // RF-2.3.4.4 / RF-2.3.4.5: generación del PDF y cambio de estado atómico.
  async generate(request, response) {
    const dto = new GenerateProposalRequestDto(request.body?.data ?? {});
    const result = await this.dependencies.generateProposalUseCase.execute(
      this.parseId(request.params.id),
      request.user.id_user,
      dto
    );

    response.status(201).json(result);
  }

  // RF-2.3.4.6: consulta de la propuesta generada.
  async get(request, response) {
    const result = await this.dependencies.getProposalUseCase.execute(
      this.parseId(request.params.id),
      request.user.id_user
    );

    response.json(result);
  }

  // RF-2.3.4.6: descarga del PDF inmutable.
  async download(request, response) {
    const { fileName, buffer } = await this.dependencies.downloadProposalUseCase.execute(
      this.parseId(request.params.id),
      request.user.id_user
    );

    response.setHeader("Content-Type", "application/pdf");
    response.setHeader("Content-Disposition", `attachment; filename="${fileName}"`);
    response.status(200).send(buffer);
  }

  // RF-2.3.4.6: envío de la propuesta al correo del cliente.
  async send(request, response) {
    await this.dependencies.sendProposalUseCase.execute(
      this.parseId(request.params.id),
      request.user.id_user
    );

    response.sendStatus(200);
  }

  parseId(value) {
    const id = Number(typeof value === "string" ? value : NaN);

    if (!Number.isInteger(id) || id < 1) {
      throw new Error("Invalid reservation request id");
    }

    return id;
  }
}

module.exports = { ProposalController };
