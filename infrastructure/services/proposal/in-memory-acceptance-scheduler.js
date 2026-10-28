// Réplica en memoria del gateway de aceptación. Por defecto agenda sin conflicto; las
// pruebas inyectan `conflicts` para simular indisponibilidad (RF-2.3.3.1).
class InMemoryAcceptanceScheduler {
  constructor({ conflicts = null } = {}) {
    this.conflicts = conflicts;
    this.scheduled = [];
  }

  async scheduleForAcceptance(requestId) {
    if (this.conflicts) {
      return { status: "unavailable", conflicts: this.conflicts };
    }

    this.scheduled.push(requestId);

    return { status: "scheduled" };
  }
}

module.exports = { InMemoryAcceptanceScheduler };
