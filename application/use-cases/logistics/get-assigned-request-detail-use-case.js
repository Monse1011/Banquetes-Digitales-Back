const CONFIRMED_STATUSES = ["Confirmado", "CONFIRMED", "Finalizado", "COMPLETED"];

class GetAssignedRequestDetailUseCase {
  constructor({ reservationRequestRepository } = {}) {
    this.reservationRequestRepository = reservationRequestRepository;
  }

  determineScheduleType(status) {
    const isConfirmed = CONFIRMED_STATUSES.some(
      (s) => s.toUpperCase() === (status || "").toUpperCase()
    );
    return isConfirmed ? "confirmado" : "propuesto";
  }

  mapResource(res) {
    return {
      type: res.type || "material",
      resource_or_operative_role:
        res.resource_or_operative_role ||
        res.resourceOrOperativeRole ||
        res.name ||
        "Sin registrar",
      quantity: res.quantity || 1,
    };
  }

  mapServices(services) {
    if (!Array.isArray(services)) return [];
    return services.map((s) => {
      const resources = s.required_resources || s.requiredResources || [];
      return {
        service_id: s.service_id || s.serviceId || s.id,
        service_name: s.service_name || s.serviceName || s.name || "Sin registrar",
        required_resources: Array.isArray(resources)
          ? resources.map((r) => this.mapResource(r))
          : [],
      };
    });
  }

  verifyAccess(request, userId) {
    const assignedId = request.logistic_user_id ?? request.logisticUserId;
    if (Number(assignedId) !== Number(userId)) {
      const err = new Error("No tiene permisos para acceder a esta solicitud.");
      err.status = 403;
      throw err;
    }
  }

  buildClientDto(request) {
    return {
      client_name: request.client_name || request.clientName,
      client_email: request.client_email || request.clientEmail,
      client_phone: request.client_phone || request.clientPhone || "Sin registrar",
    };
  }

  async execute({ requestId, userId }) {
    const request = await this.reservationRequestRepository.findById(requestId);
    if (!request) {
      const err = new Error("Solicitud de reservación no encontrada.");
      err.status = 404;
      throw err;
    }

    this.verifyAccess(request, userId);

    return {
      data: {
        request_id: request.id || request.requestId,
        folio: request.folio,
        client: this.buildClientDto(request),
        event_date: request.event_date || request.eventDate,
        start_time: request.start_time || request.startTime,
        end_time: request.end_time || request.endTime,
        schedule_type: this.determineScheduleType(request.status),
        event_address: request.event_address || request.eventAddress || "Sin registrar",
        guest_count: request.guest_count || request.guestCount,
        selected_services: this.mapServices(request.services || request.selected_services),
        status: request.status,
      },
    };
  }
}

module.exports = GetAssignedRequestDetailUseCase;
