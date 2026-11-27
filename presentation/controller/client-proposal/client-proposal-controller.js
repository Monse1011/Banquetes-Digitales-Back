const {
  AcceptProposalRequestDto,
} = require("../../../application/dto/client-proposal/accept-proposal-request-dto");
const {
  RejectProposalRequestDto,
} = require("../../../application/dto/client-proposal/reject-proposal-request-dto");
const {
  AdjustmentsRequestDto,
} = require("../../../application/dto/client-proposal/adjustments-request-dto");

// Función 4.4 y 4.5 - Contacto con el cliente: seguimiento por folio y confirmación de
// evento. Todos los endpoints son públicos, sin sesión, y solo operan mediante un folio
// válido (RF-3.4.5.12). El controlador no contiene lógica de negocio.
class ClientProposalController {
  constructor(dependencies) {
    this.dependencies = dependencies;
  }

  // RF-3.4.5.1 a RF-3.4.5.14
  async track(request, response) {
    const result = await this.dependencies.getClientRequestTrackingUseCase.execute(
      request.params.folio
    );

    response.json(result);
  }

  // RF-3.4.4.1 a RF-3.4.4.4
  async proposal(request, response) {
    const result = await this.dependencies.getClientProposalDetailUseCase.execute(
      request.params.folio
    );

    response.json(result);
  }

  // RF-3.4.4.4.2 a RF-3.4.4.4.6
  async accept(request, response) {
    new AcceptProposalRequestDto(request.body?.data ?? {}).validate();
    const result = await this.dependencies.acceptProposalUseCase.execute(request.params.folio);

    response.json(result);
  }

  // RF-3.4.4.5.2 a RF-3.4.4.5.7
  async adjustments(request, response) {
    const dto = new AdjustmentsRequestDto(request.body?.data ?? {});
    const observations = dto.validate();
    const result = await this.dependencies.requestProposalAdjustmentsUseCase.execute(
      request.params.folio,
      observations
    );

    response.json(result);
  }

  // RF-3.4.4.6.4 a RF-3.4.4.6.6
  async reject(request, response) {
    new RejectProposalRequestDto(request.body?.data ?? {}).validate();
    const result = await this.dependencies.rejectProposalUseCase.execute(request.params.folio);

    response.json(result);
  }

  // RF-3.4.4.4.3, RF-3.4.5.8, RF-3.4.5.9
  async pdf(request, response) {
    const download = request.query.download === "true";
    const { fileName, buffer, disposition } =
      await this.dependencies.getClientProposalPdfUseCase.execute(request.params.folio, {
        download,
      });

    response.setHeader("Content-Type", "application/pdf");
    response.setHeader("Content-Disposition", `${disposition}; filename="${fileName}"`);
    response.status(200).send(buffer);
  }
}

module.exports = { ClientProposalController };
