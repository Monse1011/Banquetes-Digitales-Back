const {
  FinalizeEventRequestDto,
} = require("../../../application/dto/event-closure/finalize-event-request-dto");
const { EventClosureMessages } = require("../../../domain/constants/event-closure-messages");
const { parseId } = require("../../utils/parse-id");

// Función 3.6 - Seguimiento y cierre del evento.
class EventClosureController {
  constructor(dependencies) {
    this.dependencies = dependencies;
  }

  // PATCH /api/logistics/requests/:id/ending: registra horas reales y observaciones y
  // finaliza el evento en una sola operación (RF-2.3.6.1 a RF-2.3.6.3).
  async finalize(request, response) {
    const requestId = parseId(request.params.id, EventClosureMessages.INVALID_REQUEST_ID);
    const dto = new FinalizeEventRequestDto(request.body?.data);
    const result = await this.dependencies.finalizeEventUseCase.execute(
      requestId,
      request.user.id_user,
      dto
    );

    response.status(200).json(result);
  }
}

module.exports = { EventClosureController };
