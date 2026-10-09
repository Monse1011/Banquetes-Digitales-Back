/**
 * Contrato del repositorio del calendario interno (Función 3.3). Cada operación de
 * escritura es atómica: el evento, la solicitud, las asignaciones y el registro pendiente de
 * sincronización (outbox) se guardan juntos o no se guarda nada. La disponibilidad se valida
 * dentro de la misma transacción, con bloqueo de las filas del responsable y de los recursos.
 *
 * Conflicto: { type: 'responsible' | 'resource', reason: string, folio?: string,
 * startAt?: Date, endAt?: Date, resourceId?: number, resourceName?: string, folios?: string[] }
 *
 * @typedef {Object} CalendarEventRepository
 * @property {(input: {requestId: number, title: string, now: Date}) =>
 * Promise<{status: 'scheduled', event: CalendarEvent} | {status: 'not_found'} |
 * {status: 'not_schedulable'} | {status: 'unavailable', conflicts: Conflict[]}>} schedule
 * @property {(input: {eventId: number, startAt: Date, endAt: Date, location: string,
 * now: Date}) => Promise<{status: 'rescheduled', event: CalendarEvent} | {status: 'not_found'} |
 * {status: 'not_editable'} | {status: 'already_started'} |
 * {status: 'unavailable', conflicts: Conflict[]}>} reschedule
 * @property {(input: {eventId: number, now: Date}) =>
 * Promise<{status: 'cancelled', event: CalendarEvent} | {status: 'not_found'} |
 * {status: 'not_cancellable'}>} cancel
 * @property {(id: number) => Promise<CalendarEvent | null>} findById
 * @property {(filters: {logisticUserId?: number, dayStart?: Date, dayEnd?: Date,
 * includeCancelled: boolean}, page: number, perPage: number) =>
 * Promise<{events: CalendarEvent[], totalRecords: number}>} findAll
 * @property {(now: Date) => Promise<number>} finalizeElapsed cambia Confirmado -> Finalizado
 */

module.exports = {};
