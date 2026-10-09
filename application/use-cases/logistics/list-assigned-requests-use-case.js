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

class ListAssignedRequestsUseCase {
  constructor({ reservationRequestRepository } = {}) {
    this.reservationRequestRepository = reservationRequestRepository;
  }

  normalizeStatus(status) {
    if (!status) return null;
    const s = status.trim().toUpperCase();
    for (const valid of ACTIVE_STATUSES) {
      if (valid.toUpperCase() === s) return valid;
    }
    const err = new Error("El estado indicado no es válido para solicitudes activas.");
    err.status = 400;
    throw err;
  }

  matchesStatus(reqStatus, filterStatus) {
    if (filterStatus) {
      return reqStatus.toUpperCase() === filterStatus.toUpperCase();
    }
    return ACTIVE_STATUSES.some((active) => active.toUpperCase() === reqStatus.toUpperCase());
  }

  buildSortKey(r) {
    const dateVal = r.event_date || r.eventDate || "";
    const timeVal = r.start_time || r.startTime || "";
    const folioVal = r.folio || "";
    return dateVal + " " + timeVal + " " + folioVal;
  }

  sortRequests(requests) {
    return requests.sort((a, b) => this.buildSortKey(a).localeCompare(this.buildSortKey(b)));
  }

  mapRequestDto(r) {
    const address = r.event_address || r.eventAddress;
    return {
      request_id: r.id || r.requestId,
      folio: r.folio,
      client_name: r.client_name || r.clientName,
      client_email: r.client_email || r.clientEmail,
      event_date: r.event_date || r.eventDate,
      start_time: r.start_time || r.startTime,
      end_time: r.end_time || r.endTime,
      event_address: address || "Sin registrar",
      guest_count: r.guest_count || r.guestCount,
      status: r.status,
    };
  }

  async execute({ userId, status, page = 1, perPage = 10 }) {
    const filterStatus = this.normalizeStatus(status);
    const all = await this.reservationRequestRepository.findAll({}, null, 1, 10000);
    const items = all.requests || all.items || (Array.isArray(all) ? all : []);

    const userAssigned = items.filter((r) => {
      const assignedId = r.logistic_user_id ?? r.logisticUserId;
      return (
        Number(assignedId) === Number(userId) && this.matchesStatus(r.status || "", filterStatus)
      );
    });

    const sorted = this.sortRequests(userAssigned);
    const totalRecords = sorted.length;
    const offset = (page - 1) * perPage;
    const paged = sorted.slice(offset, offset + perPage);

    return {
      data: {
        requests: paged.map((r) => this.mapRequestDto(r)),
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
