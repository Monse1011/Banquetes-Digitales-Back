const { parseId } = require("../../utils/parse-id");
const { EventTrackingMessages } = require("../../../domain/constants/event-tracking-messages");

function parsePositiveInteger(value, fallback) {
  const parsed = Number(typeof value === "string" ? value : NaN);

  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

// undefined si la fecha no es una fecha real con formato YYYY-MM-DD.
function parseDate(value) {
  if (value === undefined || value === "") return null;
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return undefined;
  const date = new Date(`${value}T00:00:00Z`);

  return !Number.isNaN(date.getTime()) && date.toISOString().startsWith(value) ? value : undefined;
}

function parseSearch(value) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

// Funciones 2.11 y 2.5: consultas de solo lectura del Administrador General.
class EventTrackingController {
  constructor(dependencies = {}) {
    this.dependencies = dependencies;
  }

  async listFinished(request, response) {
    const from = parseDate(request.query.from);
    const to = parseDate(request.query.to);

    if (from === undefined || to === undefined) {
      response.status(400).json({ message: EventTrackingMessages.DATE_INVALID });
      return;
    }

    if (from && to && from > to) {
      response.status(400).json({ message: EventTrackingMessages.DATE_RANGE_INVALID });
      return;
    }

    const result = await this.dependencies.listFinishedEventsUseCase.execute({
      filters: { search: parseSearch(request.query.search), from, to },
      page: parsePositiveInteger(request.query.page, 1),
      perPage: parsePositiveInteger(request.query.per_page, 10),
    });

    response.json(result);
  }

  async getFinished(request, response) {
    const result = await this.dependencies.getFinishedEventUseCase.execute(
      parseId(request.params.id)
    );

    response.json(result);
  }
}

module.exports = { EventTrackingController };
