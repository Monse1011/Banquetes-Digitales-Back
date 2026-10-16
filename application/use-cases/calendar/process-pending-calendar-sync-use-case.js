const { CalendarRules } = require("../../../domain/constants/calendar-rules");
const GoogleCalendarSyncException = require("../../../domain/exceptions/calendar/google-calendar-sync-exception");
const {
  deriveGoogleEventId,
  syncBackoffSeconds,
} = require("../../services/calendar/availability-rules");

const MAX_ERROR_LENGTH = 500;

// Función 3.3, bloque B - procesa las operaciones pendientes del outbox hacia Google Calendar.
// Reconcilia contra el estado ACTUAL del evento, así que repetir una operación es seguro:
//   Cancelado           -> se elimina en Google (un evento inexistente cuenta como eliminado)
//   Confirmado/Finalizado -> se crea o actualiza con el id de Google
// Un fallo nunca revierte ni pierde el evento interno: solo reprograma el reintento.
class ProcessPendingCalendarSyncUseCase {
  constructor(
    calendarEventRepository,
    calendarSyncRepository,
    calendarGateway,
    clock = () => new Date()
  ) {
    this.calendarEventRepository = calendarEventRepository;
    this.calendarSyncRepository = calendarSyncRepository;
    this.calendarGateway = calendarGateway;
    this.clock = clock;
  }

  async execute({ eventId = null, limit = CalendarRules.SYNC_BATCH_SIZE } = {}) {
    const summary = { processed: 0, synced: 0, failed: 0 };

    for (let index = 0; index < limit; index++) {
      const now = this.clock();
      const entry = await this.calendarSyncRepository.claimNext({
        now,
        leaseUntil: new Date(now.getTime() + CalendarRules.SYNC_LEASE_SECONDS * 1000),
        eventId,
      });

      if (!entry) break;

      summary.processed++;

      if (await this.processEntry(entry)) {
        summary.synced++;
      } else {
        summary.failed++;
      }
    }

    return summary;
  }

  async processEntry(entry) {
    try {
      const event = await this.calendarEventRepository.findById(entry.eventId);

      if (!event) {
        throw new Error(`Calendar event ${entry.eventId} not found`);
      }

      const googleEventId = await this.reconcile(event);

      await this.calendarSyncRepository.markSynced({
        outboxId: entry.id,
        eventId: entry.eventId,
        googleEventId,
        now: this.clock(),
      });

      return true;
    } catch (error) {
      await this.registerFailure(entry, error);
      return false;
    }
  }

  async reconcile(event) {
    const googleEventId = event.googleEventId ?? deriveGoogleEventId(event.id);

    if (event.isCancelled()) {
      await this.calendarGateway.deleteEvent(googleEventId);
      return googleEventId;
    }

    const result = await this.calendarGateway.upsertEvent(
      googleEventId,
      {
        summary: event.title,
        description: `Folio: ${event.folio}`,
        location: event.location,
        startAt: event.startAt,
        endAt: event.endAt,
      },
      { exists: Boolean(event.googleEventId) }
    );

    // Respuesta inválida: sin id no es posible actualizar ni eliminar después.
    if (!result || typeof result.googleEventId !== "string" || result.googleEventId === "") {
      throw new GoogleCalendarSyncException(
        "INVALID_RESPONSE",
        "Google Calendar no devolvió el identificador del evento"
      );
    }

    return result.googleEventId;
  }

  async registerFailure(entry, error) {
    const now = this.clock();
    const message = String(error?.message ?? error).slice(0, MAX_ERROR_LENGTH);

    try {
      await this.calendarSyncRepository.markFailed({
        outboxId: entry.id,
        eventId: entry.eventId,
        errorMessage: error?.code ? `[${error.code}] ${message}` : message,
        nextAttemptAt: new Date(now.getTime() + syncBackoffSeconds(entry.attempts + 1) * 1000),
        now,
      });
    } catch (persistenceError) {
      // La operación sigue pendiente: su reserva vence y otro ciclo la retomará.
      console.error(
        `Could not record calendar sync failure for outbox ${entry.id}:`,
        persistenceError.message
      );
    }
  }
}

module.exports = { ProcessPendingCalendarSyncUseCase };
