/**
 * Incremento 3 (Función 4.4): gateway que revalida la disponibilidad del responsable y
 * de los recursos (sin contar la propia solicitud) y agenda el evento conforme a la
 * Función 3.3. Devuelve 'scheduled' o 'unavailable' con los conflictos.
 * @typedef {Object} ProposalAcceptanceScheduler
 * @property {(requestId: number, options: {now: Date, transaction: Object|null}) =>
 *   Promise<{status: string, conflicts?: Array}>} scheduleForAcceptance
 */

module.exports = {};
