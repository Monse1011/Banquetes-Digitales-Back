// Función 3.6: cuerpo de PATCH /api/logistics/requests/{request_id}/ending (objeto "data").
// Solo conserva los campos del contrato; la validación vive en el caso de uso.
class FinalizeEventRequestDto {
  constructor(data) {
    const body = data !== null && typeof data === "object" && !Array.isArray(data) ? data : {};

    this.actualStartAt = body.actual_start_at;
    this.actualEndAt = body.actual_end_at;
    this.eventObservation = body.event_observation;
    this.status = body.status;
  }
}

module.exports = { FinalizeEventRequestDto };
