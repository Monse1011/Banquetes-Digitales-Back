const {
  ReservationRequestStatus,
} = require("../../../domain/enums/reservation-request/request-status");

// ?status= recibe las claves del enum RequestStatus del DAD (PENDING, APPROVED, ...).
const STATUS_BY_QUERY_VALUE = ReservationRequestStatus;

class ReservationRequestController {
  constructor(dependencies) {
    this.dependencies = dependencies;
  }

  async create(request, response) {
    const result = await this.dependencies.createReservationRequestUseCase.execute(request.body);

    response.status(201).json(result);
  }

  async list(request, response) {
    const status = this.parseStatus(request.query.status);

    if (request.query.status !== undefined && status === undefined) {
      response
        .status(400)
        .json({ message: "El estado indicado no es válido para consultar solicitudes." });
      return;
    }

    const result = await this.dependencies.getReservationRequestsUseCase.execute({
      page: this.parsePositiveInteger(request.query.page, 1),
      perPage: this.parsePositiveInteger(request.query.per_page, 10),
      filters: status ? { status } : {},
    });

    response.json(result);
  }

  async getById(request, response) {
    const id = this.parseId(request.params.id);
    const result = await this.dependencies.getReservationRequestUseCase.execute(id);

    response.json(result);
  }

  async approve(request, response) {
    const status = request.body?.status;

    if (status !== ReservationRequestStatus.APPROVED) {
      response.status(400).json({ message: `Status must be ${ReservationRequestStatus.APPROVED}` });
      return;
    }

    const result = await this.dependencies.approveReservationRequestUseCase.execute(
      this.parseId(request.params.id)
    );

    response.json(result);
  }

  // Función 2.4: PATCH /api/admin/requests/:id/assignment (respuesta solo código HTTP).
  // data.request_id es opcional: responsable actual esperado para rechazar
  // reasignaciones basadas en información vencida (RF-1.2.4.7).
  async assign(request, response) {
    const id = this.parseId(request.params.id);
    const data = request.body?.data ?? {};
    const userId = Number(data.user_id);
    const hasCurrentLogisticUser = data.request_id !== undefined && data.request_id !== null;
    const currentLogisticUserId = hasCurrentLogisticUser ? Number(data.request_id) : null;

    if (!Number.isInteger(userId) || userId < 1) {
      response.status(400).json({ message: "El identificador del usuario es obligatorio." });
      return;
    }

    if (
      hasCurrentLogisticUser &&
      (!Number.isInteger(currentLogisticUserId) || currentLogisticUserId < 1)
    ) {
      response
        .status(400)
        .json({ message: "El identificador del responsable actual no es válido." });
      return;
    }

    await this.dependencies.assignReservationRequestUseCase.execute(
      id,
      userId,
      request.user.id_user,
      currentLogisticUserId
    );

    response.sendStatus(200);
  }

  parseStatus(value) {
    if (typeof value !== "string") {
      return undefined;
    }

    return STATUS_BY_QUERY_VALUE[value.trim().toUpperCase()];
  }

  parseId(value) {
    const id = Number(typeof value === "string" ? value : NaN);

    if (!Number.isInteger(id) || id < 1) {
      throw new Error("Invalid reservation request id");
    }

    return id;
  }

  parsePositiveInteger(value, fallback) {
    const parsed = Number(typeof value === "string" ? value : NaN);

    return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
  }
}

module.exports = { ReservationRequestController };
