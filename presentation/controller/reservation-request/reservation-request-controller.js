const {
  ReservationRequestStatus,
  TrackedReservationRequestStatuses,
} = require("../../../domain/enums/reservation-request/request-status");
const { AdminRequestMessages } = require("../../../domain/constants/admin-request-messages");
const { parseId } = require("../../utils/parse-id");
const ListAssignedRequestsUseCase = require("../../../application/use-cases/logistics/list-assigned-requests-use-case");
const GetAssignedRequestsHistoryUseCase = require("../../../application/use-cases/logistics/get-assigned-requests-history-use-case");
const GetAssignedRequestDetailUseCase = require("../../../application/use-cases/logistics/get-assigned-request-detail-use-case");

// Entero de la query; undefined si viene pero no es un entero.
function parseQueryInteger(value, fallback) {
  if (value === undefined) return fallback;
  const parsed = Number(typeof value === "string" && value.trim() ? value : NaN);
  return Number.isInteger(parsed) ? parsed : undefined;
}

// undefined si la fecha no es una fecha real con formato YYYY-MM-DD.
function parseDate(value) {
  if (value === undefined) return null;
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return undefined;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().startsWith(value) ? value : undefined;
}

// ?status= recibe exactamente las claves del enum RequestStatus del DAD; con active=true solo
// las de los siete estados activos (RF-1.2.5.2).
function parseStatuses(query) {
  if (query.active !== undefined && !["true", "false"].includes(query.active)) return undefined;
  const active = query.active === "true";
  if (query.status === undefined) return active ? TrackedReservationRequestStatuses : null;
  const status =
    typeof query.status === "string" && Object.hasOwn(ReservationRequestStatus, query.status)
      ? ReservationRequestStatus[query.status]
      : undefined;
  if (!status || (active && !TrackedReservationRequestStatuses.includes(status))) return undefined;
  return [status];
}

// DAD v3.0: page mínimo 1 y per_page entre 1 y 100.
function isValidPagination(page, perPage) {
  return page >= 1 && perPage >= 1 && perPage <= 100;
}

// { error } si las fechas no son válidas o el rango está invertido.
function parseDateRange(query) {
  const eventDateFrom = parseDate(query.event_date_from);
  const eventDateTo = parseDate(query.event_date_to);
  if (eventDateFrom === undefined || eventDateTo === undefined) {
    return { error: AdminRequestMessages.DATE_INVALID };
  }
  if (eventDateFrom && eventDateTo && eventDateFrom > eventDateTo) {
    return { error: AdminRequestMessages.DATE_RANGE_INVALID };
  }
  return { eventDateFrom, eventDateTo };
}

// DAD v3.0, GET /api/admin/requests: devuelve { error } o { filters, page, perPage }.
function parseListQuery(query) {
  const page = parseQueryInteger(query.page, 1);
  const perPage = parseQueryInteger(query.per_page, 10);
  if (!isValidPagination(page, perPage)) return { error: AdminRequestMessages.PAGINATION_INVALID };
  const statuses = parseStatuses(query);
  if (statuses === undefined) return { error: AdminRequestMessages.STATUS_INVALID };
  const logisticUserId = parseQueryInteger(query.logistic_user_id, null);
  if (logisticUserId === undefined || (logisticUserId !== null && logisticUserId < 1)) {
    return { error: AdminRequestMessages.LOGISTIC_USER_ID_INVALID };
  }
  const { error, eventDateFrom, eventDateTo } = parseDateRange(query);
  if (error) return { error };
  const search =
    typeof query.search === "string" && query.search.trim() ? query.search.trim() : null;

  return {
    filters: { statuses, search, logisticUserId, eventDateFrom, eventDateTo },
    page,
    perPage,
  };
}

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
      (repo
        ? new GetAssignedRequestDetailUseCase({
            reservationRequestRepository: repo,
            serviceRepository: dependencies.serviceRepository,
          })
        : null);
  }

  async create(request, response) {
    const result = await this.dependencies.createReservationRequestUseCase.execute(request.body);

    response.status(201).json(result);
  }

  // Funciones 2.4, 2.5 y 2.11 (DAD v3.0).
  async list(request, response) {
    const { error, ...input } = parseListQuery(request.query);

    if (error) {
      response.status(400).json({ message: error });
      return;
    }

    const result = await this.dependencies.getReservationRequestsUseCase.execute(input);

    response.json(result);
  }

  async getById(request, response) {
    const id = parseId(request.params.id, AdminRequestMessages.REQUEST_ID_INVALID);
    const result = await this.dependencies.getReservationRequestUseCase.execute(id);

    response.json(result);
  }

  // El contrato publica el código "APPROVED"; se acepta también la etiqueta "Aprobada" por
  // compatibilidad con clientes anteriores.
  async approve(request, response) {
    const status = request.body?.status;

    if (status !== "APPROVED" && status !== ReservationRequestStatus.APPROVED) {
      response.status(400).json({ message: "Status must be APPROVED" });
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

    try {
      const result = await useCase.execute({
        userId,
        status,
        page,
        perPage,
      });

      response.json(result);
    } catch (error) {
      if (error.status === 400 || error.status === 403 || error.status === 404) {
        response.status(error.status).json({ message: error.message });
        return;
      }
      throw error;
    }
  }

  // Función 3.1: GET /api/logistics/requests/history
  async listHistoryForLogistics(request, response) {
    const userId = request.user?.id_user ?? request.user?.id;
    const page = this.parsePositiveInteger(request.query.page, 1);
    const perPage = this.parsePositiveInteger(request.query.per_page, 10);
    const status = request.query.status ? request.query.status.trim() : null;

    const useCase =
      this.getAssignedRequestsHistoryUseCase || this.dependencies.getAssignedRequestsHistoryUseCase;

    try {
      const result = await useCase.execute({
        userId,
        status,
        page,
        perPage,
      });

      response.json(result);
    } catch (error) {
      if (error.status === 400 || error.status === 403 || error.status === 404) {
        response.status(error.status).json({ message: error.message });
        return;
      }
      throw error;
    }
  }

  // Función 3.1: GET /api/logistics/requests/:id
  async getByIdForLogistics(request, response) {
    let requestId;
    try {
      requestId = this.parseId(request.params.id);
    } catch (err) {
      response.status(400).json({ message: err.message });
      return;
    }

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
