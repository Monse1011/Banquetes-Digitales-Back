/**
 * Contrato del repositorio del seguimiento y cierre del evento (Función 3.6, DAD 010).
 *
 * @typedef {Object} EventClosureSnapshot
 * @property {number} requestId
 * @property {string} status Estado guardado de la solicitud (p. ej. "Confirmado").
 * @property {number|null} logisticUserId Responsable de logística asignado.
 * @property {Date} scheduledStartAt Inicio vigente del evento.
 * @property {Date|null} scheduledEndAt Fin vigente del evento (null si no se registró).
 *
 * @typedef {Object} EventClosureRepository
 * @property {(requestId: number, transaction: Transaction) =>
 *   Promise<EventClosureSnapshot | null>} findForUpdate Bloquea la solicitud (SELECT ... FOR
 *   UPDATE) y devuelve su horario vigente: el del evento del calendario (que también refleja
 *   las reprogramaciones) o, si no existe, la fila más reciente de derived_information o, si
 *   tampoco hay, los datos de la solicitud. Inicio y fin siempre proceden de la misma fuente.
 * @property {(closure: {requestId: number, previousStatus: string, newStatus: string,
 *   actualStartAt: Date, actualEndAt: Date, eventObservation: string|null,
 *   changedByUserId: number}, transaction: Transaction) => Promise<{statusChangedAt: Date}>}
 *   finalize Guarda horas reales y observación, cambia el estado, inserta la fila de
 *   request_status_history y actualiza status_changed_at.
 */

module.exports = {};
