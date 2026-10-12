const ACTIVE_STATUSES = Object.freeze([
  "Asignada",
  "ASSIGNED",
  "Coordinación Lista",
  "Coordinacion Lista",
  "COORDINATION_READY",
  "Coordinación Incompleta",
  "Coordinacion Incompleta",
  "COORDINATION_INCOMPLETE",
  "Propuesta generada",
  "PROPUESTA_GENERADA",
  "PROPOSAL_GENERATED",
  "Confirmado",
  "CONFIRMED",
]);

function valueOrFallback(value, fallback = "Sin registrar") {
  return value || fallback;
}

class ListAssignedRequestsUseCase {
  constructor({ reservationRequestRepository } = {}) {
    this.reservationRequestRepository = reservationRequestRepository;
  }

  normalizeStatus(status) {
    if (!status) return null;
    const normalized = status.trim().toUpperCase();
    for (const validStatus of ACTIVE_STATUSES) {
      if (validStatus.toUpperCase() === normalized) return validStatus;
    }
    const error = new Error("El estado indicado no es válido para solicitudes activas.");
    error.status = 400;
    throw error;
  }

  matchesStatus(reqStatus, filterStatus) {
    if (filterStatus) {
      return reqStatus.toUpperCase() === filterStatus.toUpperCase();
    }
    return ACTIVE_STATUSES.some(
      (activeStatus) => activeStatus.toUpperCase() === reqStatus.toUpperCase()
    );
  }

  buildSortKey(request) {
    const dateValue = request.event_date || request.eventDate || "";
    const timeValue = request.start_time || request.startTime || "";
    const folioValue = request.folio || "";
    return `${dateValue} ${timeValue} ${folioValue}`;
  }

  sortRequests(requests) {
    return [...requests].sort((requestA, requestB) => {
      const timeA = requestA.eventDateTime instanceof Date ? requestA.eventDateTime.getTime() : NaN;
      const timeB = requestB.eventDateTime instanceof Date ? requestB.eventDateTime.getTime() : NaN;
      if (!Number.isNaN(timeA) && !Number.isNaN(timeB) && timeA !== timeB) {
        return timeA - timeB;
      }
      return this.buildSortKey(requestA).localeCompare(this.buildSortKey(requestB));
    });
  }

  mapRequestDto(request) {
    return {
      request_id: request.id || request.requestId,
      folio: request.folio,
      client_name: valueOrFallback(request.client_name || request.clientName),
      client_email: valueOrFallback(request.client_email || request.clientEmail),
      event_date: valueOrFallback(request.event_date || request.eventDate, ""),
      start_time: valueOrFallback(request.start_time || request.startTime, ""),
      end_time: valueOrFallback(request.end_time || request.endTime, ""),
      event_address: valueOrFallback(request.event_address || request.eventAddress),
      guest_count: request.guest_count || request.guestCount,
      status: request.status,
    };
  }

  async execute({ userId, status, page = 1, perPage = 10 }) {
    const filterStatus = this.normalizeStatus(status);

    const queryFilters = {
      logisticUserId: userId,
      status: filterStatus ? [filterStatus, filterStatus.toUpperCase()] : ACTIVE_STATUSES,
    };
    const sort = { field: "EVENT_DATE", direction: "asc" };

    const repositoryResult = await this.reservationRequestRepository.findAll(
      queryFilters,
      sort,
      page,
      perPage
    );

    let items =
      repositoryResult.requests ||
      repositoryResult.items ||
      (Array.isArray(repositoryResult) ? repositoryResult : []);

    let totalRecords = repositoryResult.totalRecords ?? repositoryResult.total_records;

    // Fallback if the repository did not filter in-database
    if (totalRecords === undefined) {
      const userAssigned = items.filter((request) => {
        const assignedId = request.logistic_user_id ?? request.logisticUserId;
        return (
          Number(assignedId) === Number(userId) &&
          this.matchesStatus(request.status || "", filterStatus)
        );
      });
      totalRecords = userAssigned.length;
      const sorted = this.sortRequests(userAssigned);
      const offset = (page - 1) * perPage;
      items = sorted.slice(offset, offset + perPage);
    } else {
      items = this.sortRequests(items);
    }

    // RF-2.3.1.2: Si el Personal de Logística no tiene solicitudes de eventos asignadas,
    // el sistema debe mostrar el mensaje: “No tiene solicitudes de eventos asignadas.”
    if (totalRecords === 0) {
      return {
        message: "No tiene solicitudes de eventos asignadas.",
        data: {
          requests: [],
          message: "No tiene solicitudes de eventos asignadas.",
        },
        metadata: {
          pagination: {
            total_records: 0,
            page,
            per_page: perPage,
          },
        },
      };
    }

    return {
      data: {
        requests: items.map((request) => this.mapRequestDto(request)),
      },
      metadata: {
        pagination: {
          total_records: totalRecords,
          page,
          per_page: perPage,
        },
      },
    };
  }
}

module.exports = ListAssignedRequestsUseCase;
