/**
 * Asignaciones de recursos a solicitudes (Función 3.2). Cada recurso lleva una versión que
 * aumenta cuando cambia lo que bloquea su disponibilidad; saveProvisional, confirm y
 * releaseProvisional solo guardan si las versiones leídas con findBlocking siguen vigentes
 * (RF-2.3.2.22) y devuelven null en caso contrario.
 *
 * @typedef {Object} ResourceAssignmentRepository
 * @property {(resourceIds: number[], period: {start: Date, end: Date},
 * excludeRequestId: number) => Promise<{assignments: ResourceAssignment[],
 * versions: Object<number, number>}>} findBlocking asignaciones Provisional o Confirmada de
 * otras solicitudes cuyo periodo de bloqueo se traslapa con period
 * @property {(requestId: number) => Promise<ResourceAssignment[]>} findActiveByRequest
 * asignaciones Provisional y Confirmada de la solicitud
 * @property {(requestId: number, assignments: ResourceAssignment[],
 * expectedVersions: Object<number, number>) => Promise<ResourceAssignment[] | null>}
 * saveProvisional registra las provisionales y libera las provisionales previas de los
 * mismos recursos
 * @property {(confirmed: ResourceAssignment[], releasedIds: number[],
 * expectedVersions: Object<number, number>, confirmation: ResourceConfirmation) =>
 * Promise<boolean | null>} confirm guarda la revisión y descarta las observaciones pendientes
 * @property {(requestId: number) => Promise<number>} releaseProvisional libera las
 * provisionales, descarta las observaciones pendientes y devuelve cuántas liberó
 * @property {(requestId: number, observations: string | null) => Promise<void>}
 * savePendingObservations observaciones de la sesión aún no confirmadas
 * @property {(requestId: number) => Promise<string | null>} findPendingObservations
 * @property {(requestId: number) => Promise<ResourceConfirmation | null>}
 * findLatestConfirmation
 */

module.exports = {};
