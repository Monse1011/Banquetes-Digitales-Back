// GET /api/logistics/resources/<tipo>?request_id=. metadata.request muestra el horario vigente
// en solo lectura (RF-2.3.2.4) y las observaciones de la solicitud (RF-2.3.2.19).
class RequestResourcesAvailabilityResponseDto {
  constructor(
    resources,
    totalRecords,
    page,
    perPage,
    requestId,
    folio,
    status,
    eventDate,
    startTime,
    endTime,
    observations,
    pendingObservations
  ) {
    this.data = { resources };
    this.metadata = {
      pagination: {
        total_records: totalRecords,
        page,
        per_page: perPage,
      },
      request: {
        request_id: requestId,
        folio,
        status,
        event_date: eventDate,
        start_time: startTime,
        end_time: endTime,
        observations,
        pending_observations: pendingObservations,
      },
    };
  }
}

module.exports = RequestResourcesAvailabilityResponseDto;
