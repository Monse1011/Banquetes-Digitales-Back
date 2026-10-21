/* eslint-disable camelcase */
function getRequestData(body) {
  if (body === null || typeof body !== "object" || Array.isArray(body)) return {};
  if (body.data === null || typeof body.data !== "object" || Array.isArray(body.data)) return body;

  const { data, ...outerFields } = body;

  return { ...outerFields, ...data };
}

class CalendarController {
  constructor({
    scheduleEventUseCase,
    editEventUseCase,
    cancelEventUseCase,
    listCalendarEventsUseCase,
    retryCalendarSyncUseCase,
  }) {
    this.retryCalendarSyncUseCase = retryCalendarSyncUseCase;
    this.scheduleEventUseCase = scheduleEventUseCase;
    this.editEventUseCase = editEventUseCase;
    this.cancelEventUseCase = cancelEventUseCase;
    this.listCalendarEventsUseCase = listCalendarEventsUseCase;
  }

  async schedule(req, res, next) {
    try {
      const requestId = Number(req.params.id);
      if (!Number.isSafeInteger(requestId) || requestId < 1) {
        return res.status(422).json({
          status: "error",
          message: "Error de validación",
          errors: { id: "El ID de la solicitud debe ser un entero positivo." },
        });
      }

      const result = await this.scheduleEventUseCase.execute(requestId, req.user);
      const event = result?.event ?? result;

      return res.status(201).json({
        data: {
          event_id: event.id,
          request_id: event.requestId,
          status: event.status,
          sync_status: event.syncStatus,
          google_event_id: event.googleEventId ?? null,
        },
      });
    } catch (error) {
      next(error);
    }
  }

  async edit(req, res, next) {
    try {
      const eventId = Number(req.params.id);
      const input = getRequestData(req.body);

      await this.editEventUseCase.execute(eventId, req.user, input);

      return res.status(200).end();
    } catch (error) {
      next(error);
    }
  }

  async cancel(req, res, next) {
    try {
      const eventId = Number(req.params.id);

      await this.cancelEventUseCase.execute(eventId, req.user);

      return res.status(200).end();
    } catch (error) {
      next(error);
    }
  }

  async retrySync(req, res, next) {
    try {
      const eventId = Number(req.params.id);
      if (!Number.isSafeInteger(eventId) || eventId < 1) {
        return res.status(422).json({ message: "El ID del evento debe ser un entero positivo." });
      }
      const { event, syncWarning } = await this.retryCalendarSyncUseCase.execute(eventId, req.user);
      return res.json({
        data: { event_id: event.id, sync_status: event.syncStatus },
        message: syncWarning,
      });
    } catch (error) {
      next(error);
    }
  }

  async list(req, res, next) {
    try {
      const { date, include_cancelled, page, per_page } = req.query;

      const result = await this.listCalendarEventsUseCase.execute({
        actor: req.user,
        date,
        includeCancelled: include_cancelled === "true",
        page: page ? Number(page) : 1,
        perPage: per_page ? Number(per_page) : undefined,
      });

      const response = {
        status: "success",
        data: { events: result.events },
        metadata: {
          pagination: {
            total_records: result.totalRecords,
            page: result.page,
            per_page: result.perPage,
          },
        },
      };

      if (result.message) {
        response.message = result.message;
      }

      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  }
}

module.exports = CalendarController;
