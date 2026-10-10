const ReservationRequestNotFoundException = require("../../../domain/exceptions/reservation-request/reservation-request-not-found-exception");
const ProvisionalAssignmentNotFoundException = require("../../../domain/exceptions/resource-assignment/provisional-assignment-not-found-exception");

// Función 3.2 - Confirmación de recursos. Lo usan el responsable de logística de la solicitud y
// el Administrador General (RF-2.3.2.21).
class ResourceAssignmentController {
  constructor(useCases) {
    this.useCases = useCases;
  }

  // GET /api/logistics/resources/<tipo>?request_id= (RF-2.3.2.5). Reutiliza el análisis de
  // filtros y paginación del controlador del tipo de recurso.
  async listResources(request, response, resourceController) {
    const result = await this.useCases.getAvailability.execute(
      this.parseRequestId(request.query.request_id),
      this.sessionUser(request),
      resourceController.type,
      resourceController.listInput(request.query, true)
    );

    response.json(result);
  }

  // POST /api/logistics/requests/:id/resources (respuesta sin cuerpo)
  async assign(request, response) {
    const body = request.body ?? {};

    await this.useCases.assignResources.execute(
      this.parseRequestId(request.params.id),
      this.sessionUser(request),
      { data: body.data, observations: body.observations }
    );

    response.status(204).end();
  }

  // DELETE /api/logistics/requests/:id/resources/:resourceId (respuesta sin cuerpo)
  async release(request, response) {
    await this.useCases.releaseResource.execute(
      this.parseRequestId(request.params.id),
      this.sessionUser(request),
      this.parseResourceId(request.params.resourceId)
    );

    response.status(204).end();
  }

  // POST /api/logistics/requests/:id/resources/confirm
  async confirm(request, response) {
    const result = await this.useCases.confirmResources.execute(
      this.parseRequestId(request.params.id),
      this.sessionUser(request),
      { observations: request.body?.observations }
    );

    response.json(result);
  }

  // POST /api/logistics/requests/:id/resources/cancel
  async cancel(request, response) {
    const result = await this.useCases.cancelConfirmation.execute(
      this.parseRequestId(request.params.id),
      this.sessionUser(request)
    );

    response.json(result);
  }

  sessionUser(request) {
    return { id: request.user.id_user, role: request.user.role };
  }

  parseRequestId(value) {
    const id = this.parseId(value);

    if (id === null) {
      throw new ReservationRequestNotFoundException();
    }

    return id;
  }

  parseResourceId(value) {
    const id = this.parseId(value);

    if (id === null) {
      throw new ProvisionalAssignmentNotFoundException();
    }

    return id;
  }

  parseId(value) {
    const id = Number(typeof value === "string" ? value : NaN);

    return Number.isSafeInteger(id) && id >= 1 ? id : null;
  }
}

module.exports = { ResourceAssignmentController };
