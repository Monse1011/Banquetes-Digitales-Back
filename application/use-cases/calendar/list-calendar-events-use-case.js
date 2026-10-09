const { CalendarMessages } = require("../../../domain/constants/calendar-messages");
const { CalendarRules } = require("../../../domain/constants/calendar-rules");
const CalendarValidationException = require("../../../domain/exceptions/calendar/calendar-validation-exception");
const { assertCanListEvents, isAdmin } = require("../../services/calendar/calendar-access-policy");
const { toCalendarEventDto } = require("../../dto/calendar/calendar-event-dto");

const DATE_REGEX = /^(\d{4})-(\d{2})-(\d{2})$/;

// Devuelve el inicio del día (hora local del servidor) o null si la fecha no es válida.
function parseDayStart(value) {
  const match = typeof value === "string" ? DATE_REGEX.exec(value) : null;

  if (!match) return null;

  const [year, month, day] = [Number(match[1]), Number(match[2]), Number(match[3])];
  const date = new Date(year, month - 1, day);
  const isRealDate =
    date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day;

  return isRealDate ? date : null;
}

// Función 3.3, bloque E - Consulta del calendario.
class ListCalendarEventsUseCase {
  constructor(calendarEventRepository, clock = () => new Date()) {
    this.calendarEventRepository = calendarEventRepository;
    this.clock = clock;
  }

  async execute({ actor, date, includeCancelled = false, page = 1, perPage } = {}) {
    assertCanListEvents(actor);

    const filters = { includeCancelled: includeCancelled === true };

    if (date !== undefined) {
      const dayStart = parseDayStart(date);

      if (!dayStart) {
        throw new CalendarValidationException({ date: CalendarMessages.INVALID_FILTER_DATE });
      }

      filters.dayStart = dayStart;
      filters.dayEnd = new Date(
        dayStart.getFullYear(),
        dayStart.getMonth(),
        dayStart.getDate() + 1
      );
    }

    // E.2 / E.7: el filtro por responsable lo impone el backend según el rol del token.
    if (!isAdmin(actor)) {
      filters.logisticUserId = actor.id;
    }

    // F.3: el estado se actualiza al consultar, sin depender solo del proceso periódico.
    await this.calendarEventRepository.finalizeElapsed(this.clock());

    const size = perPage ?? CalendarRules.DEFAULT_PAGE_SIZE;
    const result = await this.calendarEventRepository.findAll(filters, page, size);

    return {
      events: result.events.map(toCalendarEventDto),
      totalRecords: result.totalRecords,
      page,
      perPage: size,
      // E.6
      message:
        result.totalRecords === 0 && date !== undefined ? CalendarMessages.NO_EVENTS : undefined,
    };
  }
}

module.exports = { ListCalendarEventsUseCase };
