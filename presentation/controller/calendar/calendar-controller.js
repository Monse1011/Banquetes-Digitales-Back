const { toConflictDto } = require("../../../application/dto/calendar/calendar-event-dto");

class CalendarController {
  constructor({
    scheduleEventUseCase,
    editEventUseCase,
    cancelEventUseCase,
    listCalendarEventsUseCase,
    retryCalendarSyncUseCase
  }) {
    this.scheduleEventUseCase = scheduleEventUseCase;
    this.editEventUseCase = editEventUseCase;
    this.cancelEventUseCase = cancelEventUseCase;
    this.listCalendarEventsUseCase = listCalendarEventsUseCase;
    this.retryCalendarSyncUseCase = retryCalendarSyncUseCase;
  }

  async schedule(req, res, next) {
    try {
      const { request_id } = req.body;
      if (!request_id) {
        return res.status(422).json({
          status: 'error',
          message: 'Error de validación',
          errors: { request_id: 'El ID de la solicitud es obligatorio.' }
        });
      }

      const event = await this.scheduleEventUseCase.execute(request_id, req.user);
      
      let message = 'Evento agendado exitosamente';
      if (event.syncStatus === 'Pendiente de sincronización') {
        message = 'El evento se guardó, pero no pudo sincronizarse con Google Calendar.';
      }

      res.status(201).json({
        status: 'success',
        message,
        data: { event }
      });
    } catch (error) {
      this._handleCalendarError(error, res, next);
    }
  }

  async edit(req, res, next) {
    try {
      const eventId = Number(req.params.id);
      const input = {
        startAt: req.body.start_at,
        endAt: req.body.end_at,
        location: req.body.location
      };

      const event = await this.editEventUseCase.execute(eventId, req.user, input);

      let message = 'Evento modificado exitosamente';
      if (event.syncStatus === 'Pendiente de sincronización') {
        message = 'El evento se actualizó, pero no pudo sincronizarse con Google Calendar.';
      }

      res.status(200).json({
        status: 'success',
        message,
        data: { event }
      });
    } catch (error) {
      this._handleCalendarError(error, res, next);
    }
  }

  async cancel(req, res, next) {
    try {
      const eventId = Number(req.params.id);
      const confirmed = req.body.confirmed === true;

      const event = await this.cancelEventUseCase.execute(eventId, req.user, confirmed);

      let message = 'Evento cancelado exitosamente';
      if (event.syncStatus === 'Pendiente de sincronización') {
        message = 'El evento se canceló internamente, pero no pudo sincronizarse con Google Calendar.';
      }

      res.status(200).json({
        status: 'success',
        message,
        data: { event }
      });
    } catch (error) {
      this._handleCalendarError(error, res, next);
    }
  }

  async list(req, res, next) {
    try {
      const { date, include_cancelled, page, per_page } = req.query;

      const result = await this.listCalendarEventsUseCase.execute({
        actor: req.user,
        date,
        includeCancelled: include_cancelled === 'true',
        page: page ? Number(page) : 1,
        perPage: per_page ? Number(per_page) : undefined
      });

      const response = {
        status: 'success',
        data: { events: result.events },
        metadata: {
          pagination: {
            total_records: result.totalRecords,
            page: result.page,
            per_page: result.perPage
          }
        }
      };

      if (result.message) {
        response.message = result.message;
      }

      res.status(200).json(response);
    } catch (error) {
      this._handleCalendarError(error, res, next);
    }
  }

  async retrySync(req, res, next) {
    try {
      const eventId = Number(req.params.id);
      const event = await this.retryCalendarSyncUseCase.execute(eventId, req.user);

      res.status(200).json({
        status: 'success',
        message: 'Sincronización reintentada exitosamente',
        data: { event }
      });
    } catch (error) {
      this._handleCalendarError(error, res, next);
    }
  }

  _handleCalendarError(error, res, next) {
    if (error.name === 'CalendarValidationException') {
      return res.status(422).json({
        status: 'error',
        message: 'Error de validación',
        errors: error.errors
      });
    }

    if (error.name === 'CalendarEventNotFoundException') {
      return res.status(404).json({
        status: 'error',
        message: error.message || 'Evento no encontrado'
      });
    }

    if (error.name === 'EventAvailabilityConflictException') {
      return res.status(409).json({
        status: 'error',
        message: error.message,
        conflicts: error.conflicts
      });
    }

    if (error.name === 'EventNotModifiableException' || error.name === 'RequestNotSchedulableException') {
      return res.status(400).json({
        status: 'error',
        message: error.message
      });
    }

    if (error.name === 'CancellationNotConfirmedException') {
      return res.status(400).json({
        status: 'error',
        message: error.message || 'Debe confirmar la cancelación explícitamente'
      });
    }

    if (error.name === 'UnauthorizedAccessException' || error.name === 'AccessDeniedException') {
      return res.status(403).json({
        status: 'error',
        message: error.message || 'No tiene permisos para realizar esta acción'
      });
    }

    next(error);
  }
}

module.exports = CalendarController;
