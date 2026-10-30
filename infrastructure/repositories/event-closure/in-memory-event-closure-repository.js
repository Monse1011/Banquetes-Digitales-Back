// Implementación en memoria de la Función 3.6 para pruebas. Cada elemento de events es un
// EventClosureSnapshot (ver application/repositories/event-closure/event-closure-repository).
class InMemoryEventClosureRepository {
  constructor(events = [], clock = () => new Date()) {
    this.events = new Map(events.map((event) => [event.requestId, { ...event }]));
    this.history = [];
    this.clock = clock;
  }

  async findForUpdate(requestId) {
    const event = this.events.get(Number(requestId));

    return event ? { ...event } : null;
  }

  async finalize(closure, transaction = null) {
    const event = this.events.get(closure.requestId);
    const before = { ...event };
    const statusChangedAt = this.clock();

    Object.assign(event, {
      status: closure.newStatus,
      actualStartAt: closure.actualStartAt,
      actualEndAt: closure.actualEndAt,
      eventObservation: closure.eventObservation,
      statusChangedAt,
    });
    this.history.push({
      requestId: closure.requestId,
      previousStatus: closure.previousStatus,
      newStatus: closure.newStatus,
      changedAt: statusChangedAt,
      changedByUserId: closure.changedByUserId,
    });

    transaction?.afterRollback(() => {
      this.events.set(closure.requestId, before);
      this.history.pop();
    });

    return { statusChangedAt };
  }
}

module.exports = { InMemoryEventClosureRepository };
