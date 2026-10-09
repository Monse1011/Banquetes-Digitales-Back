const HISTORY_STATUSES = Object.freeze([
  "Finalizado",
  "COMPLETED",
  "Cancelado",
  "CANCELLED",
  "REJECTED",
]);

class GetAssignedRequestsHistoryUseCase {
  constructor({ reservationRequestRepository } = {}) {
    this.reservationRequestRepository = reservationRequestRepository;
  }

  normalizeStatus(status) {
    if (!status) return null;
    const s = status.trim().toUpperCase();
    for (const valid of HISTORY_STATUSES) {
      if (valid.toUpperCase() === s) return valid;
    }
    const err = new Error("El estado indicado no es válido para el historial.");
    err.status = 400;
    throw err;
  }

  matchesStatus(reqStatus, filterStatus) {
    if (filterStatus) {
      return reqStatus.toUpperCase() === filterStatus.toUpperCase();
    }
    return HISTORY_STATUSES.some((h) => h.toUpperCase() === reqStatus.toUpperCase());
  }

  compareHistory(a, b) {
    const dateA = a.event_date || a.eventDate || "";
    const dateB = b.event_date || b.eventDate || "";
    if (dateA !== dateB) {
      return dateB.localeCompare(dateA);
    }
    return (b.folio || "").localeCompare(a.folio || "");
  }

  sortRequests(requests) {
    return requests.sort((a, b) => this.compareHistory(a, b));
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

    const userHistory = items.filter((r) => {
      const assignedId = r.logistic_user_id ?? r.logisticUserId;
      return (
        Number(assignedId) === Number(userId) && this.matchesStatus(r.status || "", filterStatus)
      );
    });

    const sorted = this.sortRequests(userHistory);
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

module.exports = GetAssignedRequestsHistoryUseCase;
