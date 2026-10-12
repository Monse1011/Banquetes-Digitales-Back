const HISTORY_STATUSES = Object.freeze([
  "Finalizado",
  "COMPLETED",
  "Cancelado",
  "CANCELLED",
  "REJECTED",
]);

function valueOrFallback(value, fallback = "Sin registrar") {
  return value || fallback;
}

function extractTimestamp(request) {
  if (request.eventDateTime instanceof Date) {
    return request.eventDateTime.getTime();
  }
  return NaN;
}

class GetAssignedRequestsHistoryUseCase {
  constructor({ reservationRequestRepository } = {}) {
    this.reservationRequestRepository = reservationRequestRepository;
  }

  normalizeStatus(status) {
    if (!status) return null;
    const normalized = status.trim().toUpperCase();
    for (const validStatus of HISTORY_STATUSES) {
      if (validStatus.toUpperCase() === normalized) return validStatus;
    }
    const error = new Error("El estado indicado no es válido para el historial.");
    error.status = 400;
    throw error;
  }

  matchesStatus(reqStatus, filterStatus) {
    if (filterStatus) {
      return reqStatus.toUpperCase() === filterStatus.toUpperCase();
    }
    return HISTORY_STATUSES.some(
      (historyStatus) => historyStatus.toUpperCase() === reqStatus.toUpperCase()
    );
  }

  compareHistory(requestA, requestB) {
    const timeA = extractTimestamp(requestA);
    const timeB = extractTimestamp(requestB);
    if (!Number.isNaN(timeA) && !Number.isNaN(timeB) && timeA !== timeB) {
      return timeB - timeA;
    }
    const dateA = requestA.event_date || requestA.eventDate || "";
    const dateB = requestB.event_date || requestB.eventDate || "";
    if (dateA !== dateB) {
      return dateB.localeCompare(dateA);
    }
    return (requestB.folio || "").localeCompare(requestA.folio || "");
  }

  sortRequests(requests) {
    return [...requests].sort((requestA, requestB) => this.compareHistory(requestA, requestB));
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
      status: filterStatus ? [filterStatus, filterStatus.toUpperCase()] : HISTORY_STATUSES,
    };
    const sort = { field: "EVENT_DATE", direction: "desc" };

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

    // Fallback if repository did not filter in-database
    if (totalRecords === undefined) {
      const userHistory = items.filter((request) => {
        const assignedId = request.logistic_user_id ?? request.logisticUserId;
        return (
          Number(assignedId) === Number(userId) &&
          this.matchesStatus(request.status || "", filterStatus)
        );
      });
      totalRecords = userHistory.length;
      const sorted = this.sortRequests(userHistory);
      const offset = (page - 1) * perPage;
      items = sorted.slice(offset, offset + perPage);
    } else {
      items = this.sortRequests(items);
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

module.exports = GetAssignedRequestsHistoryUseCase;
