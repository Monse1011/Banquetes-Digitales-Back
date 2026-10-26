// Incremento 3 (RF-3.4.4.4.3): adapta el calendario interno al contrato de aceptación de
// la propuesta. La creación del evento ocurre dentro de la transacción del accept; la
// sincronización con Google Calendar se dispara después del commit y, si falla, el evento
// queda pendiente de reintento (RF-2.3.3.3).
class PostgresProposalAcceptanceScheduler {
  constructor(calendarEventRepository, syncProcessor) {
    this.calendarEventRepository = calendarEventRepository;
    this.syncProcessor = syncProcessor;
  }

  async scheduleForAcceptance(requestId, { now, transaction } = {}) {
    const connection = transaction?.connection;

    if (!connection) {
      return { status: "unavailable", conflicts: [{ reason: "no_transaction" }] };
    }

    const result = await this.calendarEventRepository.scheduleForAcceptance({
      requestId,
      title: `Evento ${requestId}`,
      now,
      connection,
    });

    if (result.status === "scheduled" && this.syncProcessor) {
      // El reintento posterior al commit no debe romper la aceptación.
      Promise.resolve(this.syncProcessor.execute?.()).catch(() => undefined);
    }

    return result;
  }
}

module.exports = { PostgresProposalAcceptanceScheduler };
