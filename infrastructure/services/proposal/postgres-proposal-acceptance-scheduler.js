// Incremento 3 (RF-3.4.4.4.3): adapta el calendario interno al contrato de aceptación de
// la propuesta. La creación del evento ocurre dentro de la transacción del accept.
class PostgresProposalAcceptanceScheduler {
  constructor(calendarEventRepository) {
    this.calendarEventRepository = calendarEventRepository;
  }

  async scheduleForAcceptance(requestId, { now, transaction } = {}) {
    const connection = transaction?.connection;

    if (!connection) {
      return { status: "unavailable", conflicts: [{ reason: "no_transaction" }] };
    }

    return this.calendarEventRepository.scheduleForAcceptance({
      requestId,
      title: `Evento ${requestId}`,
      now,
      connection,
    });
  }
}

module.exports = { PostgresProposalAcceptanceScheduler };
