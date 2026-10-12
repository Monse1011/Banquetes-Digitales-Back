const CONFIRMED_STATUSES = ["Confirmado", "CONFIRMED", "Finalizado", "COMPLETED"];

function valueOrFallback(value, fallback = "Sin registrar") {
  return value || fallback;
}

class GetAssignedRequestDetailUseCase {
  constructor({ reservationRequestRepository } = {}) {
    this.reservationRequestRepository = reservationRequestRepository;
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

  buildDetailDto(request) {
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
      selected_services: this.mapServices(request.services || request.selected_services),
      status: request.status,
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

    return {
      data: this.buildDetailDto(request),
    };
  }
}

module.exports = GetAssignedRequestDetailUseCase;
