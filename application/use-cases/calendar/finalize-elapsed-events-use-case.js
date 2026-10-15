// Función 3.3, F.3 - cambia automáticamente «Confirmado» a «Finalizado» al transcurrir la
// hora de fin. Los recursos siguen bloqueados tres horas más (lo deriva el repositorio).
class FinalizeElapsedEventsUseCase {
  constructor(calendarEventRepository, clock = () => new Date()) {
    this.calendarEventRepository = calendarEventRepository;
    this.clock = clock;
  }

  async execute() {
    return this.calendarEventRepository.finalizeElapsed(this.clock());
  }
}

module.exports = { FinalizeElapsedEventsUseCase };
