// Contratos 13/14 (función 2.15): las cuatro consultas del reporte. Sin tablas nuevas
// (AD-04); universos de RF-1.2.15.2.x, filtros combinados con AND (RF-1.2.15.3.15),
// cliente por correo sin mayúsculas ni espacios, servicio/promoción por id.
//
// Fecha vigente del evento (DAD §3, §6.1 del plan): el derived_information más reciente
// (created_at desc, id desc) aporta la fecha de start_datetime en hora de Mérida; sin
// acuerdos, reservations_request.event_date (que ya es una fecha local de Mérida).
const PeriodType = require("../../../domain/enums/report/period-type");
const ReportType = require("../../../domain/enums/report/report-type");

const MERIDA_OFFSET = "INTERVAL '-06:00'";
const meridaDate = (column) => `(${column} AT TIME ZONE ${MERIDA_OFFSET})::date`;
const EFFECTIVE_DATE = `COALESCE(${meridaDate("di.start_datetime")}, rr.event_date)`;
const DERIVED_LATERAL = `LEFT JOIN LATERAL (
    SELECT d.start_datetime FROM derived_information d
    WHERE d.request_id = rr.id
    ORDER BY d.created_at DESC, d.id DESC
    LIMIT 1
  ) di ON TRUE`;

// Periodo + cliente. Los extras por tipo (servicio/promoción) se añaden después con los
// índices de parámetro consecutivos que devuelve el builder.
function buildBaseFilters(query, dateExpr) {
  const values = [];
  const conditions = [];

  const push = (sql, ...params) => {
    const placeholders = params.map((param) => {
      values.push(param);

      return `$${values.length}`;
    });
    conditions.push(sql(...placeholders));
  };

  if (query.period_type === PeriodType.DAY) {
    push((p) => `${dateExpr} = ${p}::date`, query.date);
  } else if (query.period_type === PeriodType.MONTH) {
    push(
      (p) => `${dateExpr} >= ${p}::date AND ${dateExpr} < (${p}::date + interval '1 month')::date`,
      `${query.month}-01`
    );
  } else if (query.period_type === PeriodType.RANGE) {
    push((from, to) => `${dateExpr} BETWEEN ${from}::date AND ${to}::date`, query.from, query.to);
  }

  if (query.client_email) {
    push((p) => `LOWER(BTRIM(c.email)) = LOWER(BTRIM(${p}))`, query.client_email);
  }

  return { conditions, values };
}

function whereSql(conditions) {
  return conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
}

class PostgresReportRepository {
  constructor(pool) {
    this.pool = pool;
  }

  // REQUESTS: todas las solicitudes, periodo por request_date (RF-1.2.15.2.1/15.3.15).
  async fetchRequests(query) {
    const { conditions, values } = buildBaseFilters(query, meridaDate("rr.request_date"));

    const result = await this.pool.query(
      `SELECT rr.folio, c.full_name AS client_name, rr.request_date,
              TO_CHAR(rr.event_date, 'YYYY-MM-DD') AS event_date, rr.status
         FROM reservations_request rr
         JOIN clients c ON c.id = rr.client_id
         ${whereSql(conditions)}
        ORDER BY rr.request_date DESC, rr.id DESC`,
      values
    );

    return result.rows;
  }

  // EVENTS: solicitudes FINALIZED, periodo por la fecha vigente del evento
  // (RF-1.2.15.2.2). La promoción es la de la propuesta ACCEPTED vigente (copias + estado
  // actual); servicio por existencia en request_services; ambos por id.
  async fetchEvents(query) {
    const { conditions, values } = buildBaseFilters(query, EFFECTIVE_DATE);
    conditions.push("rr.status = 'FINALIZED'");

    if (query.service_id !== null && query.service_id !== undefined) {
      values.push(query.service_id);
      conditions.push(`EXISTS (SELECT 1 FROM request_services rs
                                 WHERE rs.request_id = rr.id AND rs.service_id = $${values.length})`);
    }
    if (query.promotion_id !== null && query.promotion_id !== undefined) {
      values.push(query.promotion_id);
      conditions.push(`acc.promotion_id = $${values.length}`);
    }

    const result = await this.pool.query(
      `SELECT rr.folio, c.full_name AS client_name,
              TO_CHAR(${EFFECTIVE_DATE}, 'YYYY-MM-DD') AS event_date,
              ARRAY(SELECT rs.service_name_snapshot FROM request_services rs
                     WHERE rs.request_id = rr.id
                     ORDER BY rs.service_name_snapshot, rs.service_id) AS services,
              acc.promotion_name_snapshot, acc.promotion_status
         FROM reservations_request rr
         JOIN clients c ON c.id = rr.client_id
         ${DERIVED_LATERAL}
         LEFT JOIN LATERAL (
           SELECT p.promotion_id, p.promotion_name_snapshot, pr.status AS promotion_status
             FROM proposals p
             LEFT JOIN promotions pr ON pr.id = p.promotion_id
            WHERE p.request_id = rr.id AND p.status = 'ACCEPTED'
            ORDER BY p.version DESC
            LIMIT 1
         ) acc ON TRUE
         ${whereSql(conditions)}
        ORDER BY ${EFFECTIVE_DATE} DESC, rr.folio DESC`,
      values
    );

    return result.rows.map((row) => ({
      folio: row.folio,
      client_name: row.client_name,
      event_date: row.event_date,
      services: row.services,
      promotion: row.promotion_name_snapshot
        ? { name: row.promotion_name_snapshot, status: row.promotion_status }
        : null,
    }));
  }

  // SERVICES: filas de request_services de solicitudes CONFIRMED o FINALIZED, incluidos
  // servicios INACTIVE (RF-1.2.15.2.3). Nombre y estado actuales del catálogo; el orden
  // y el "(No vigente)" los hace report-builder.
  async fetchServiceUsage(query) {
    const { conditions, values } = buildBaseFilters(query, EFFECTIVE_DATE);
    conditions.push("rr.status IN ('CONFIRMED', 'FINALIZED')");

    if (query.service_id !== null && query.service_id !== undefined) {
      values.push(query.service_id);
      conditions.push(`rs.service_id = $${values.length}`);
    }

    const result = await this.pool.query(
      `SELECT s.id AS service_id, s.name, s.status, COUNT(*)::int AS times_contracted
         FROM request_services rs
         JOIN reservations_request rr ON rr.id = rs.request_id
         JOIN services s ON s.id = rs.service_id
         JOIN clients c ON c.id = rr.client_id
         ${DERIVED_LATERAL}
         ${whereSql(conditions)}
        GROUP BY s.id, s.name, s.status
        ORDER BY s.id`,
      values
    );

    return result.rows;
  }

  // PROMOTIONS: propuestas ACCEPTED con promotion_id de solicitudes CONFIRMED o FINALIZED,
  // sin importar la vigencia de la promoción (RF-1.2.15.2.4).
  async fetchPromotionUsage(query) {
    const { conditions, values } = buildBaseFilters(query, EFFECTIVE_DATE);
    conditions.push("p.status = 'ACCEPTED' AND p.promotion_id IS NOT NULL");
    conditions.push("rr.status IN ('CONFIRMED', 'FINALIZED')");

    if (query.promotion_id !== null && query.promotion_id !== undefined) {
      values.push(query.promotion_id);
      conditions.push(`pr.id = $${values.length}`);
    }

    const result = await this.pool.query(
      `SELECT pr.id AS promotion_id, pr.name, pr.status, COUNT(*)::int AS times_used
         FROM proposals p
         JOIN reservations_request rr ON rr.id = p.request_id
         JOIN promotions pr ON pr.id = p.promotion_id
         JOIN clients c ON c.id = rr.client_id
         ${DERIVED_LATERAL}
         ${whereSql(conditions)}
        GROUP BY pr.id, pr.name, pr.status
        ORDER BY pr.id`,
      values
    );

    return result.rows;
  }

  async findServiceName(id) {
    const result = await this.pool.query("SELECT name FROM services WHERE id = $1", [id]);

    return result.rows[0]?.name ?? null;
  }

  async findPromotionName(id) {
    const result = await this.pool.query("SELECT name FROM promotions WHERE id = $1", [id]);

    return result.rows[0]?.name ?? null;
  }

  async fetchByType(query) {
    const fetchers = {
      [ReportType.REQUESTS]: () => this.fetchRequests(query),
      [ReportType.EVENTS]: () => this.fetchEvents(query),
      [ReportType.SERVICES]: () => this.fetchServiceUsage(query),
      [ReportType.PROMOTIONS]: () => this.fetchPromotionUsage(query),
    };

    return fetchers[query.type]();
  }
}

module.exports = { PostgresReportRepository };
