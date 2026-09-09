const { ReservationRequest } = require('../../domain/entities/reservation-request');
const { ReservationRequestSortField } = require('../../application/dto/reservation-request-sort');

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
      request.guestCount,
      request.eventAddress,
      request.status,
      request.requestDate,
      request.updateDate,
      request.servicesIds
    );

    this.requests.push(createdRequest);
    return createdRequest;
  }

  async findById(id) {
    return this.requests.find(request => request.id === id) ?? null;
  }

  async update(request) {
    const index = this.requests.findIndex(
      existingRequest => existingRequest.id === request.id
    );

    if (index === -1) {
      throw new Error('Reservation request not found');
    }

    this.requests[index] = request;
    return request;
  }

  async findAll(filters, sort, page, perPage) {
    const filteredRequests = this.requests.filter(request => {
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

      return sort.direction === 'asc' ? comparison : -comparison;
    });

    const start = (page - 1) * perPage;

    return {
      requests: sortedRequests.slice(start, start + perPage),
      totalRecords: filteredRequests.length
    };
  }

  getSortValue(request, field) {
    switch (field) {
      case ReservationRequestSortField.EventDate:
        return request.eventDateTime.getTime();
      case ReservationRequestSortField.Status:
        return request.status;
      case ReservationRequestSortField.ClientName:
        return request.clientId;
    }
  }
}

module.exports = { InMemoryReservationRequestRepository };
