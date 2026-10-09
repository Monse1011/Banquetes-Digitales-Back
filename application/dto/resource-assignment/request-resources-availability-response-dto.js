const { formatDate, formatTime } = require("../../services/date-time-formatter");

function toAssignmentDto(assignment) {
  if (!assignment) return null;

  return {
    requested_quantity: assignment.requestedQuantity,
    assigned_quantity: assignment.assignedQuantity,
    available_quantity: assignment.availableQuantity,
    sufficiency: assignment.sufficiency,
    status: assignment.status,
    observation: assignment.observation,
  };
}

// Listado de GET /api/logistics/resources/<tipo>?request_id=: cada recurso agrega su cantidad
// disponible para el periodo del evento (RF-2.3.2.5) y lo ya registrado para la solicitud
// (RF-2.3.2.19). metadata.request muestra el horario vigente en solo lectura (RF-2.3.2.4).
class RequestResourcesAvailabilityResponseDto {
  constructor(items, totalRecords, page, perPage, request, observations) {
    this.data = {
      resources: items.map(({ summary, operativeRole, available, assignment }) => ({
        ...summary,
        ...(operativeRole !== undefined ? { operative_role: operativeRole } : {}),
        available_quantity: available,
        assignment: toAssignmentDto(assignment),
      })),
    };
    this.metadata = {
      pagination: { total_records: totalRecords, page, per_page: perPage },
      request: {
        request_id: request.requestId,
        folio: request.folio,
        status: request.status,
        event_date: formatDate(request.eventDateTime),
        start_time: formatTime(request.eventDateTime),
        end_time: formatTime(request.eventEndTime),
        observations: observations.confirmed,
        pending_observations: observations.pending,
      },
    };
  }
}

module.exports = RequestResourcesAvailabilityResponseDto;
