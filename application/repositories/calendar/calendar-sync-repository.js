/**
 * Contrato de la bandeja de salida (outbox) de sincronización con Google Calendar. Las
 * filas pendientes las crea el repositorio de eventos dentro de la misma transacción que el
 * cambio interno; este repositorio solo las reclama, resuelve o reprograma.
 *
 * @typedef {Object} CalendarSyncRepository
 * @property {(input: {now: Date, leaseUntil: Date, eventId?: number | null}) =>
 * Promise<{id: number, eventId: number, operation: string, attempts: number} | null>} claimNext
 * reserva la siguiente operación vencida (varios workers no toman la misma)
 * @property {(input: {outboxId: number, eventId: number, googleEventId: string, now: Date}) =>
 * Promise<void>} markSynced guarda el id de Google y marca «Sincronizado» si no queda nada
 * pendiente para el evento
 * @property {(input: {outboxId: number, eventId: number, errorMessage: string,
 * nextAttemptAt: Date, now: Date}) => Promise<void>} markFailed el evento permanece
 * «Pendiente de sincronización»
 * @property {(input: {eventId: number, now: Date}) => Promise<number>} requeue vuelve
 * inmediatamente elegibles las operaciones pendientes del evento (reintento manual)
 */

module.exports = {};
