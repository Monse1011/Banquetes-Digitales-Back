/**
 * Puerto hacia el calendario corporativo externo (Función 3.3, bloque B). La sincronización
 * es unidireccional: Banquetes Digitales -> calendario. Toda implementación debe lanzar
 * GoogleCalendarSyncException ante fallos de configuración, red, tiempo de espera, errores
 * HTTP o respuestas inválidas.
 *
 * ExternalEvent: { summary: string, description: string, location: string, startAt: Date,
 * endAt: Date }
 *
 * @typedef {Object} ExternalCalendarGateway
 * @property {(googleEventId: string, event: ExternalEvent, options?: {exists?: boolean}) =>
 * Promise<{googleEventId: string}>} upsertEvent crea o actualiza (idempotente por id)
 * @property {(googleEventId: string) => Promise<void>} deleteEvent un evento ya inexistente
 * se considera eliminado
 */

module.exports = {};
