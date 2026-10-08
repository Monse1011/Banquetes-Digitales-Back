const {
  ReservationRequest,
} = require("../../../domain/entities/reservation-request/reservation-request");
const {
  ReservationRequestStatus,
  ActiveReservationRequestStatuses,
  ReassignableReservationRequestStatuses,
} = require("../../../domain/enums/reservation-request/request-status");
const {
  ReservationRequestSortField,
} = require("../../../domain/enums/reservation-request/reservation-request-sort-field");

class InMemoryReservationRequestRepository {
  constructor() {
    this.requests = [];
    this.nextId = 1;
  }

  async create(request) {
    const createdRequest = new ReservationRequest(
      this.nextId++,
      request.folio,
      request.clientId,
      request.userId,
      request.eventDateTime,
      request.eventEndTime,
      request.guestCount,
      request.eventAddress,
      request.status,
      request.requestDate,
      request.servicesIds,
      request.logisticUserId,
      request.assignedByUserId,
      request.assignedAt
    );

    this.requests.push(createdRequest);
    return createdRequest;
  }

  async findById(id) {
    return this.requests.find((request) => request.requestId === id) ?? null;
  }

  async update(request) {
    const index = this.requests.findIndex(
      (existingRequest) => existingRequest.requestId === request.requestId
    );

    if (index === -1) {
      throw new Error("Reservation request not found");
    }

    this.requests[index] = request;
    return request;
  }

  // RF-1.2.4.3 / RF-1.2.4.4 / RF-1.2.4.7: valida estado, responsable actual esperado
  // y traslape, y registra la (re)asignación en una sola operación atómica
  // (ejecución single-thread).
  async assign(requestId, logisticUserId, assignedByUserId, currentLogisticUserId = null) {
    const request = await this.findById(requestId);

    if (!request) {
      return { status: "not_found" };
    }

    if (!ReassignableReservationRequestStatuses.includes(request.status)) {
      return { status: "not_reassignable" };
    }

    if (currentLogisticUserId !== null && request.logisticUserId !== currentLogisticUserId) {
      return { status: "assignment_conflict" };
    }

    const overlapping = this.requests.filter(
      (existingRequest) =>
        existingRequest.requestId !== requestId &&
        existingRequest.logisticUserId === logisticUserId &&
        ActiveReservationRequestStatuses.includes(existingRequest.status) &&
        existingRequest.eventDateTime < request.eventEndTime &&
        existingRequest.eventEndTime > request.eventDateTime
    );

    if (overlapping.length > 0) {
      return {
        status: "overlap",
        conflicts: overlapping.map((conflict) => ({
          folio: conflict.folio,
          startDateTime: conflict.eventDateTime,
          endDateTime: conflict.eventEndTime,
        })),
      };
    }

    request.status = ReservationRequestStatus.ASSIGNED;
    request.logisticUserId = logisticUserId;
    request.assignedByUserId = assignedByUserId;
    request.assignedAt = new Date();

    return { status: "assigned", request };
  }

  async findAll(filters, sort, page, perPage) {
    const filteredRequests = this.requests.filter((request) => {
      if (filters.status && request.status !== filters.status) {
        return false;
      }

      if (
        filters.eventDate &&
        request.eventDateTime.toISOString().slice(0, 10) !==
          filters.eventDate.toISOString().slice(0, 10)
      ) {
        return false;
      }

      return true;
    });

    const sortedRequests = [...filteredRequests].sort((left, right) => {
      const leftValue = this.getSortValue(left, sort.field);
      const rightValue = this.getSortValue(right, sort.field);
      const comparison = leftValue < rightValue ? -1 : leftValue > rightValue ? 1 : 0;

      return sort.direction === "asc" ? comparison : -comparison;
    });

    const start = (page - 1) * perPage;

    return {
      requests: sortedRequests.slice(start, start + perPage),
      totalRecords: filteredRequests.length,
    };
  }

  getSortValue(request, field) {
    switch (field) {
      case ReservationRequestSortField.EVENT_DATE:
        return request.eventDateTime.getTime();
      case ReservationRequestSortField.STATUS:
        return request.status;
      case ReservationRequestSortField.CLIENT_NAME:
        return request.clientId;
    }
  }
}

module.exports = { InMemoryReservationRequestRepository };
