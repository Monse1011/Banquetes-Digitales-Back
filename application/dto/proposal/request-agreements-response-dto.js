const {
  formatDate,
  formatTime,
} = require("../../services/reservation-request/date-time-formatter");

// RF-2.3.4.1 / RF-2.3.4.2: datos previos de la solicitud para el formulario de
// acuerdos: contacto del cliente, horario vigente y recursos asignados.
class RequestAgreementsResponseDto {
  constructor({ request, client, assignedResources, canRegisterAgreements, scheduleType }) {
    this.data = {
      request_id: request.requestId,
      folio: request.folio,
      status: request.status,
      client: {
        client_name: client?.fullName ?? "Sin registrar",
        client_email: client?.email ?? "Sin registrar",
        client_phone: client?.phone || "Sin registrar",
      },
      location: request.eventAddress || "Sin registrar",
      event_date: formatDate(request.eventDateTime),
      start_time: formatTime(request.eventDateTime),
      end_time: formatTime(request.eventEndTime),
      schedule_type: scheduleType,
      guest_count: request.guestCount,
      can_register_agreements: canRegisterAgreements,
      assigned_resources: assignedResources.map((resource) => ({
        resource_id: resource.resourceId,
        name: resource.name,
        type: resource.type,
        quantity: resource.quantity,
        unit_cost: resource.unitCost,
      })),
    };
  }
}

module.exports = { RequestAgreementsResponseDto };
