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

function matchesStatus(request, filters) {
  if (filters.status) {
    if (Array.isArray(filters.status)) {
      return filters.status.some(
        (candidate) => candidate.toUpperCase() === (request.status || "").toUpperCase()
      );
    }
    return request.status?.toUpperCase() === filters.status.toUpperCase();
  }
  if (filters.statuses && Array.isArray(filters.statuses)) {
    return filters.statuses.some(
      (candidate) => candidate.toUpperCase() === (request.status || "").toUpperCase()
    );
  }
  return true;
}

function matchesLogisticUser(request, filters) {
  const logisticUserId = filters.logisticUserId ?? filters.logistic_user_id;
  if (logisticUserId !== undefined && logisticUserId !== null) {
    const requestLogisticId = request.logisticUserId ?? request.logistic_user_id;
    return Number(requestLogisticId) === Number(logisticUserId);
  }
  return true;
}

function matchesEventDate(request, filters) {
  if (filters.eventDate) {
    return (
      request.eventDateTime.toISOString().slice(0, 10) ===
      filters.eventDate.toISOString().slice(0, 10)
    );
  }
  return true;
}

function matchesClientName(request, filters) {
  if (filters.clientName) {
    const name = request.clientName || request.client_name || "";
    return name.toLowerCase().includes(filters.clientName.toLowerCase());
  }
  return true;
}

function getClientField(request, key, alias) {
  return request[key] || request[alias] || null;
}

class InMemoryReservationRequestRepository {
  constructor() {
    this.requests = [];
    this.nextId = 1;
  }

  async create(request) {
    const id = request.requestId || request.id || this.nextId++;
    const clientName = getClientField(request, "clientName", "client_name");
    const clientEmail = getClientField(request, "clientEmail", "client_email");
    const clientPhone = getClientField(request, "clientPhone", "client_phone");

    const createdRequest = new ReservationRequest(
      id,
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
      request.assignedAt,
      clientName,
      clientEmail,
      clientPhone
    );

    createdRequest.services = request.services || [];
    createdRequest.selected_services = request.selected_services || [];

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

  async findAll(filters = {}, sort = null, page = 1, perPage = 10) {
    const filteredRequests = this.requests.filter(
      (request) =>
        matchesStatus(request, filters) &&
        matchesLogisticUser(request, filters) &&
        matchesEventDate(request, filters) &&
        matchesClientName(request, filters)
    );

    const sortField = sort?.field ?? ReservationRequestSortField.EVENT_DATE;
    const sortDirection = sort?.direction ?? "asc";

    const sortedRequests = [...filteredRequests].sort((requestA, requestB) => {
      const valueA = this.getSortValue(requestA, sortField);
      const valueB = this.getSortValue(requestB, sortField);
      let comparison = 0;
      if (valueA < valueB) comparison = -1;
      else if (valueA > valueB) comparison = 1;
      else {
        const folioA = requestA.folio || "";
        const folioB = requestB.folio || "";
        comparison = folioA.localeCompare(folioB);
      }

      return sortDirection === "asc" ? comparison : -comparison;
    });

    const start = (page - 1) * perPage;

    return {
      requests: sortedRequests.slice(start, start + perPage),
      totalRecords: filteredRequests.length,
    };
  }

  getSortValue(request, field) {
    if (field === ReservationRequestSortField.STATUS) {
      return request.status || "";
    }
    if (field === ReservationRequestSortField.CLIENT_NAME) {
      return request.clientName || request.client_name || request.clientId || "";
    }
    return request.eventDateTime instanceof Date
      ? request.eventDateTime.getTime()
      : new Date(request.eventDateTime || 0).getTime();
  }
}

module.exports = { InMemoryReservationRequestRepository };
