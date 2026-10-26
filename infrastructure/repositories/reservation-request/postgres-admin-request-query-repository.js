const { toDatabaseStatus, toApiStatus } = require("./postgres-request-status");
const {
  BlockingAssignmentStatuses,
} = require("../../../domain/enums/resource-assignment/assignment-status");

// DAD v3.0: DateTime con offset fijo -06:00 (convención de hora de Mérida), sin milisegundos.
const local = (column) => `(${column} AT TIME ZONE INTERVAL '-06:00')`;
const dateTime = (column) => `TO_CHAR(${local(column)}, 'YYYY-MM-DD"T"HH24:MI:SS') || '-06:00'`;

// Datos vigentes (DAD v3.0): el derived_information más reciente (created_at y luego id); sin
// acuerdos, los de la solicitud. Fecha, horas y dirección salen siempre de la misma fila.
// shortcut: derived_information aún no tiene guest_count; se lee de la solicitud hasta que la
// Función 3.4 agregue la columna.
const CURRENT_REQUESTS = `(
  SELECT rr.id, rr.folio, rr.status, rr.request_date, rr.status_changed_at, rr.guest_count,
    rr.logistic_user_id, c.full_name AS client_name, c.email AS client_email,
    c.phone AS client_phone, u.full_name AS logistic_user_name, u.email AS logistic_user_email,
    COALESCE(di.start_datetime, rr.event_date_time) AS current_start,
    CASE WHEN di.id IS NULL THEN rr.event_end_time ELSE di.end_datetime END AS current_end,
    COALESCE(di.location, rr.event_address) AS current_address,
    ARRAY(
      SELECT s.name FROM request_services rs JOIN services s ON s.id = rs.service_id
      WHERE rs.request_id = rr.id ORDER BY s.name
    ) AS selected_services
  FROM reservations_request rr
  JOIN clients c ON c.id = rr.client_id
  LEFT JOIN users u ON u.id_user = rr.logistic_user_id
  LEFT JOIN LATERAL (
    SELECT d.id, d.location, d.start_datetime, d.end_datetime
    FROM derived_information d
    WHERE d.request_id = rr.id
    ORDER BY d.created_at DESC, d.id DESC
    LIMIT 1
  ) di ON TRUE
) r`;

const COMMON_COLUMNS = `r.id, r.folio, r.status, r.client_name, r.client_email, r.guest_count,
  r.selected_services, r.logistic_user_id, r.logistic_user_name, r.logistic_user_email,
  r.current_address, ${dateTime("r.request_date")} AS requested_date,
  ${dateTime("r.status_changed_at")} AS status_changed_at`;

function toLogisticUser(row) {
  return row.logistic_user_id === null
    ? null
    : {
        id: Number(row.logistic_user_id),
        full_name: row.logistic_user_name,
        email: row.logistic_user_email,
      };
}

// Funciones 2.4, 2.5 y 2.11: consultas de solo lectura de GET /api/admin/requests.
class PostgresAdminRequestQueryRepository {
  constructor(pool) {
    this.pool = pool;
  }

  async findAll(filters, page, perPage) {
    const result = await this.pool.query(
      `SELECT ${COMMON_COLUMNS},
         TO_CHAR(${local("r.current_start")}, 'YYYY-MM-DD') AS event_date,
         TO_CHAR(${local("r.current_start")}, 'HH24:MI') AS start_time,
         TO_CHAR(${local("r.current_end")}, 'HH24:MI') AS end_time,
         COUNT(*) OVER()::int AS total_records
       FROM ${CURRENT_REQUESTS}
       WHERE ($1::text[] IS NULL OR r.status = ANY($1))
         AND ($2::text IS NULL OR r.folio ILIKE $2 OR r.client_name ILIKE $2)
         AND ($3::bigint IS NULL OR r.logistic_user_id = $3)
         AND ($4::date IS NULL OR ${local("r.current_start")}::date >= $4::date)
         AND ($5::date IS NULL OR ${local("r.current_start")}::date <= $5::date)
       ORDER BY r.current_start ASC, r.folio ASC
       LIMIT $6 OFFSET $7`,
      [
        filters.statuses ? filters.statuses.map(toDatabaseStatus) : null,
        filters.search ? `%${filters.search}%` : null,
        filters.logisticUserId ?? null,
        filters.eventDateFrom ?? null,
        filters.eventDateTo ?? null,
        perPage,
        (page - 1) * perPage,
      ]
    );

    return {
      // shortcut: total_records sale de la ventana, así que es 0 si se pide una página vacía.
      totalRecords: result.rows[0]?.total_records ?? 0,
      requests: result.rows.map((row) => ({
        request_id: Number(row.id),
        folio: row.folio,
        client_name: row.client_name,
        client_email: row.client_email,
        requested_date: row.requested_date,
        selected_services: row.selected_services,
        status: toApiStatus(row.status),
        status_changed_at: row.status_changed_at,
        event_date: row.event_date,
        start_time: row.start_time,
        end_time: row.end_time,
        // shortcut: la Función 3.6 aún no guarda horas reales; leerlas cuando agregue columnas.
        actual_start_at: null,
        actual_end_at: null,
        event_address: row.current_address,
        guest_count: row.guest_count,
        logistic_user: toLogisticUser(row),
      })),
    };
  }

  async findById(id) {
    const result = await this.pool.query(
      `SELECT ${COMMON_COLUMNS}, r.client_phone, r.current_start, r.current_end,
         ${dateTime("r.current_start")} AS event_date_time,
         ${dateTime("r.current_end")} AS event_end_time
       FROM ${CURRENT_REQUESTS}
       WHERE r.id = $1`,
      [id]
    );
    const row = result.rows[0];
    if (!row) return null;

    return {
      currentStart: row.current_start,
      currentEnd: row.current_end,
      request: {
        request_id: Number(row.id),
        folio: row.folio,
        client_name: row.client_name,
        client_email: row.client_email,
        client_phone: row.client_phone,
        guest_count: row.guest_count,
        event_address: row.current_address,
        event_date_time: row.event_date_time,
        event_end_time: row.event_end_time,
        requested_date: row.requested_date,
        // shortcut: la Función 3.6 aún no guarda horas reales ni observaciones del evento.
        actual_start_at: null,
        actual_end_at: null,
        status: toApiStatus(row.status),
        status_changed_at: row.status_changed_at,
        selected_services: row.selected_services,
        logistic_user: toLogisticUser(row),
        event_observation: null,
      },
      assignments: await this.findAssignments(id),
    };
  }

  // DAD v3.0: asignaciones vigentes (no liberadas) de assigned_resources.
  async findAssignments(requestId) {
    const result = await this.pool.query(
      `SELECT r.id, r.name, r.type, r.operative_role_id, op.name AS operative_role,
         r.total_quantity, r.is_active, ar.requested_quantity, ar.quantity, ar.sufficiency,
         ar.status, ar.observation
       FROM assigned_resources ar
       JOIN resources r ON r.id = ar.resource_id
       LEFT JOIN operative_roles op ON op.id = r.operative_role_id
       WHERE ar.request_id = $1 AND ar.status = ANY($2)
       ORDER BY r.name, r.id`,
      [requestId, BlockingAssignmentStatuses]
    );

    return result.rows.map((row) => ({
      ...row,
      id: Number(row.id),
      operative_role_id: row.operative_role_id === null ? null : Number(row.operative_role_id),
    }));
  }

  // Asignaciones no liberadas de otras solicitudes, con la forma que usa resource-availability.js.
  async findBlockingAssignments(resourceIds, excludeRequestId) {
    const result = await this.pool.query(
      `SELECT request_id, resource_id, quantity, usage_start, usage_end
       FROM assigned_resources
       WHERE resource_id = ANY($1) AND request_id <> $2 AND status = ANY($3)`,
      [resourceIds, excludeRequestId, BlockingAssignmentStatuses]
    );

    return result.rows.map((row) => ({
      requestId: Number(row.request_id),
      resourceId: Number(row.resource_id),
      quantity: row.quantity,
      eventStart: row.usage_start,
      eventEnd: row.usage_end,
    }));
  }
}

module.exports = { PostgresAdminRequestQueryRepository };
