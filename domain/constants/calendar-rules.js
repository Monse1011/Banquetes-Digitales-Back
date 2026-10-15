// Función 3.3: reglas numéricas del calendario.
const CalendarRules = Object.freeze({
  // F.4 / F.5: los recursos siguen bloqueados tres horas después de la hora de fin.
  POST_EVENT_BLOCK_MINUTES: 180,
  // Reintentos de sincronización: espera exponencial con tope.
  SYNC_BASE_DELAY_SECONDS: 60,
  SYNC_MAX_DELAY_SECONDS: 3600,
  // Tiempo máximo que un worker "reserva" una operación pendiente antes de que otro la tome.
  SYNC_LEASE_SECONDS: 120,
  // Operaciones procesadas por ciclo del worker.
  SYNC_BATCH_SIZE: 20,
  DEFAULT_PAGE_SIZE: 50,
});

module.exports = { CalendarRules };
