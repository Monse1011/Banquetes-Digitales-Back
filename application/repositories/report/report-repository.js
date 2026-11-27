/**
 * Contrato del repositorio de reportes (función 2.15, contratos 13 y 14 del DAD v4.0).
 * Sin tablas nuevas (AD-04): las cuatro consultas salen de reservations_request, clients,
 * request_services, services, proposals y promotions con los universos de RF-1.2.15.2.x.
 *
 * query: salida de parseReportQuery (type, period_type, date/month/from/to, client_email,
 * service_id, promotion_id). Cada método devuelve filas crudas ya filtradas (AND) y
 * ordenadas; el formateo y la gráfica los hace report-builder.
 *
 * @typedef {Object} ReportRepository
 * @property {(query: object) => Promise<Array<{folio: string, client_name: string,
 *   request_date: Date, event_date: string, status: string}>>} fetchRequests
 * @property {(query: object) => Promise<Array<{folio: string, client_name: string,
 *   event_date: string, services: string[], promotion: {name: string, status: string} | null}>>}
 *   fetchEvents
 * @property {(query: object) => Promise<Array<{service_id: number, name: string,
 *   status: string, times_contracted: number}>>} fetchServiceUsage
 * @property {(query: object) => Promise<Array<{promotion_id: number, name: string,
 *   status: string, times_used: number}>>} fetchPromotionUsage
 * @property {(id: number) => Promise<string | null>} findServiceName
 * @property {(id: number) => Promise<string | null>} findPromotionName
 */

module.exports = {};
