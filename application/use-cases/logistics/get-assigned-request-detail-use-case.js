const {
  toApiRequestStatus,
} = require("../../../domain/enums/reservation-request/request-status-api-code");

const CONFIRMED_STATUSES = ["Confirmado", "CONFIRMED", "Finalizado", "COMPLETED"];

// RF-3.4.4.5.7: "Registrar acuerdos" sigue habilitado en "Ajustes Solicitados" además de
// los estados de coordinación. El estado se normaliza al código de la API antes de comparar
// (el repositorio entrega la etiqueta en español del dominio).
const AGREEMENTS_EDITABLE_STATUSES = [
  "COORDINATION_READY",
  "COORDINATION_INCOMPLETE",
  "ADJUSTMENTS_REQUESTED",
];

function valueOrFallback(value, fallback = "Sin registrar") {
  return value || fallback;
}

class GetAssignedRequestDetailUseCase {
  constructor({
    reservationRequestRepository,
    serviceRepository,
    proposalRepository,
    proposalAdjustmentRepository,
  } = {}) {
    this.reservationRequestRepository = reservationRequestRepository;
    this.serviceRepository = serviceRepository;
    this.proposalRepository = proposalRepository ?? null;
    this.proposalAdjustmentRepository = proposalAdjustmentRepository ?? null;
  }

  determineScheduleType(status) {
    const isConfirmed = CONFIRMED_STATUSES.some(
      (confirmedStatus) => confirmedStatus.toUpperCase() === (status || "").toUpperCase()
    );
    return isConfirmed ? "confirmado" : "propuesto";
  }

  mapResource(resource) {
    return {
      type: resource.type || "material",
      resource_or_operative_role:
        resource.resource_or_operative_role ||
        resource.resourceOrOperativeRole ||
        resource.name ||
        "Sin registrar",
      quantity: resource.quantity || 1,
    };
  }

  mapServices(services) {
    if (!Array.isArray(services)) return [];
    return services.map((service) => {
      const requiredResources = service.required_resources || service.requiredResources || [];
      return {
        service_id: service.service_id || service.serviceId || service.id,
        service_name:
          service.service_name || service.serviceName || service.name || "Sin registrar",
        required_resources: Array.isArray(requiredResources)
          ? requiredResources.map((resource) => this.mapResource(resource))
          : [],
      };
    });
  }

  verifyAccess(request, userId) {
    const assignedId = request.logistic_user_id ?? request.logisticUserId;
    if (Number(assignedId) !== Number(userId)) {
      const error = new Error("No tiene permisos para acceder a esta solicitud.");
      error.status = 403;
      throw error;
    }
  }

  buildClientDto(request) {
    return {
      client_name: valueOrFallback(request.client_name || request.clientName),
      client_email: valueOrFallback(request.client_email || request.clientEmail),
      client_phone: valueOrFallback(request.client_phone || request.clientPhone),
    };
  }

  buildDetailDto(request, services, proposal = null, adjustments = []) {
    return {
      request_id: request.id || request.requestId,
      folio: request.folio,
      client: this.buildClientDto(request),
      event_date: valueOrFallback(request.event_date || request.eventDate, ""),
      start_time: valueOrFallback(request.start_time || request.startTime, ""),
      end_time: valueOrFallback(request.end_time || request.endTime, ""),
      schedule_type: this.determineScheduleType(request.status),
      event_address: valueOrFallback(request.event_address || request.eventAddress),
      guest_count: request.guest_count || request.guestCount,
      selected_services: this.mapServices(services),
      status: request.status,
      // Incremento 3 (RF-3.4.4.2 / RF-3.4.4.5.6 / RF-3.4.4.5.7).
      proposal_viewed_at: proposal?.viewedAt ? new Date(proposal.viewedAt).toISOString() : null,
      can_register_agreements: AGREEMENTS_EDITABLE_STATUSES.includes(
        toApiRequestStatus(request.status || "")
      ),
      adjustments: adjustments.map((adjustment) => ({
        id: adjustment.id,
        proposals_code: proposal?.proposalsCode ?? null,
        version: proposal?.version ?? null,
        observations: adjustment.observations,
        requested_at: adjustment.createdAt ? new Date(adjustment.createdAt).toISOString() : null,
      })),
    };
  }

  async execute({ requestId, userId }) {
    const request = await this.reservationRequestRepository.findById(requestId);
    if (!request) {
      const error = new Error("Solicitud de reservación no encontrada.");
      error.status = 404;
      throw error;
    }

    this.verifyAccess(request, userId);

    let services = request.services || request.selected_services;
    if (!services?.length && request.servicesIds?.length) {
      services = await this.serviceRepository.findByIds(request.servicesIds);
    }

    const proposal = this.proposalRepository
      ? await this.proposalRepository.findCurrentByRequestId(request.requestId)
      : null;
    const adjustments = this.proposalAdjustmentRepository
      ? await this.proposalAdjustmentRepository.findByRequestId(request.requestId)
      : [];

    return {
      data: this.buildDetailDto(request, services, proposal, adjustments),
    };
  }
}

module.exports = GetAssignedRequestDetailUseCase;
