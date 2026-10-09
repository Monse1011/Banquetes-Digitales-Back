const {
  ReservationRequestStatus,
} = require("../../../domain/enums/reservation-request/request-status");
const ListAssignedRequestsUseCase = require("../../../application/use-cases/logistics/list-assigned-requests-use-case");
const GetAssignedRequestsHistoryUseCase = require("../../../application/use-cases/logistics/get-assigned-requests-history-use-case");
const GetAssignedRequestDetailUseCase = require("../../../application/use-cases/logistics/get-assigned-request-detail-use-case");

const STATUS_BY_QUERY_VALUE = Object.freeze({
  PENDING: ReservationRequestStatus.PENDING,
  APPROVED: ReservationRequestStatus.APPROVED,
  ASSIGNED: ReservationRequestStatus.ASSIGNED,
});

class ReservationRequestController {
  constructor(dependencies = {}) {
    this.dependencies = dependencies;
    const repo = dependencies.reservationRequestRepository;

    this.listAssignedRequestsUseCase =
      dependencies.listAssignedRequestsUseCase ||
      (repo ? new ListAssignedRequestsUseCase({ reservationRequestRepository: repo }) : null);

    this.getAssignedRequestsHistoryUseCase =
      dependencies.getAssignedRequestsHistoryUseCase ||
      (repo ? new GetAssignedRequestsHistoryUseCase({ reservationRequestRepository: repo }) : null);

    this.getAssignedRequestDetailUseCase =
      dependencies.getAssignedRequestDetailUseCase ||
      (repo ? new GetAssignedRequestDetailUseCase({ reservationRequestRepository: repo }) : null);
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

  // Función 3.1: GET /api/logistics/requests
  async listForLogistics(request, response) {
    const userId = request.user?.id_user ?? request.user?.id;
    const page = this.parsePositiveInteger(request.query.page, 1);
    const perPage = this.parsePositiveInteger(request.query.per_page, 10);
    const status = request.query.status ? request.query.status.trim() : null;

    const useCase =
      this.listAssignedRequestsUseCase || this.dependencies.listAssignedRequestsUseCase;

    const result = await useCase.execute({
      userId,
      status,
      page,
      perPage,
    });

    response.json(result);
  }

  // Función 3.1: GET /api/logistics/requests/history
  async listHistoryForLogistics(request, response) {
    const userId = request.user?.id_user ?? request.user?.id;
    const page = this.parsePositiveInteger(request.query.page, 1);
    const perPage = this.parsePositiveInteger(request.query.per_page, 10);
    const status = request.query.status ? request.query.status.trim() : null;

    const useCase =
      this.getAssignedRequestsHistoryUseCase || this.dependencies.getAssignedRequestsHistoryUseCase;

    const result = await useCase.execute({
      userId,
      status,
      page,
      perPage,
    });

    response.json(result);
  }

  // Función 3.1: GET /api/logistics/requests/:id
  async getByIdForLogistics(request, response) {
    const requestId = this.parseId(request.params.id);
    const userId = request.user?.id_user ?? request.user?.id;

    const useCase =
      this.getAssignedRequestDetailUseCase || this.dependencies.getAssignedRequestDetailUseCase;

    try {
      const result = await useCase.execute({ requestId, userId });
      response.json(result);
    } catch (error) {
      if (error.status === 403 || error.status === 404 || error.status === 400) {
        response.status(error.status).json({ message: error.message });
        return;
      }
      throw error;
    }
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
