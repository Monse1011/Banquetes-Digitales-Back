// Función 3.3: reglas numéricas del calendario.
const CalendarRules = Object.freeze({
  // F.4 / F.5: los recursos siguen bloqueados tres horas después de la hora de fin.
  POST_EVENT_BLOCK_MINUTES: 180,
  DEFAULT_PAGE_SIZE: 50,
});

module.exports = { CalendarRules };
