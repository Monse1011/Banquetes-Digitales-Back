const {
  toDatabaseStatus,
  fromDatabaseStatus,
} = require("../reservation-request/postgres-request-status");

// Fechas y horas se formatean en SQL con la zona de Mérida para no depender de la del servidor.
const LIST_COLUMNS = `rr.id AS request_id, rr.folio, rr.status, c.full_name AS client_name,
  TO_CHAR(rr.event_date, 'YYYY-MM-DD') AS event_date,
  TO_CHAR(rr.event_time, 'HH24:MI') AS start_time,
  TO_CHAR(rr.event_end_time AT TIME ZONE 'America/Merida', 'HH24:MI') AS end_time,
  rr.event_address, u.full_name AS logistic_user_name`;

class PostgresEventQueryRepository {
  constructor(pool) {
    this.pool = pool;
  }

  async findAll(filters, direction, page, perPage) {
    const order = direction === "desc" ? "DESC" : "ASC";
    const result = await this.pool.query(
      `SELECT ${LIST_COLUMNS}, COUNT(*) OVER()::int AS total_records
       FROM reservations_request rr
       JOIN clients c ON c.id = rr.client_id
       LEFT JOIN users u ON u.id_user = rr.logistic_user_id
       WHERE rr.status = ANY($1)
         AND ($2::text IS NULL OR c.full_name ILIKE $2 OR rr.folio ILIKE $2)
         AND ($3::date IS NULL OR rr.event_date >= $3::date)
         AND ($4::date IS NULL OR rr.event_date <= $4::date)
         AND ($5::bigint IS NULL OR rr.logistic_user_id = $5::bigint)
       ORDER BY rr.event_date_time ${order}, rr.folio ASC
       LIMIT $6 OFFSET $7`,
      [
        filters.statuses.map(toDatabaseStatus),
        filters.search ? `%${filters.search}%` : null,
        filters.from ?? null,
        filters.to ?? null,
        filters.logisticUserId ?? null,
        perPage,
        (page - 1) * perPage,
      ]
    );

    return {
      // shortcut: total_records sale de la ventana, así que es 0 si se pide una página vacía.
      totalRecords: result.rows[0]?.total_records ?? 0,
      events: result.rows.map(({ total_records: _total, ...row }) => ({
        ...row,
        request_id: Number(row.request_id),
        status: fromDatabaseStatus(row.status),
      })),
    };
  }

  async findById(id, statuses) {
    const result = await this.pool.query(
      `SELECT ${LIST_COLUMNS}, rr.guest_count, c.email AS client_email, c.phone AS client_phone,
         u.email AS logistic_user_email
       FROM reservations_request rr
       JOIN clients c ON c.id = rr.client_id
       LEFT JOIN users u ON u.id_user = rr.logistic_user_id
       WHERE rr.id = $1 AND rr.status = ANY($2)`,
      [id, statuses.map(toDatabaseStatus)]
    );
    const row = result.rows[0];
    if (!row) return null;

    return {
      request_id: Number(row.request_id),
      folio: row.folio,
      status: fromDatabaseStatus(row.status),
      client: { name: row.client_name, email: row.client_email, phone: row.client_phone },
      event: {
        date: row.event_date,
        start_time: row.start_time,
        end_time: row.end_time,
        address: row.event_address,
        guest_count: row.guest_count,
      },
      logistic_user: row.logistic_user_name
        ? { name: row.logistic_user_name, email: row.logistic_user_email }
        : null,
      resources: await this.findConfirmedResources(id),
    };
  }

  async findConfirmedResources(requestId) {
    const result = await this.pool.query(
      `SELECT r.type, r.name, op.name AS operative_role, ar.quantity
       FROM assigned_resources ar
       JOIN resources r ON r.id = ar.resource_id
       LEFT JOIN operative_roles op ON op.id = r.operative_role_id
       WHERE ar.request_id = $1 AND ar.status = 'CONFIRMED'
       ORDER BY r.type, r.name`,
      [requestId]
    );

    return result.rows;
  }
}

module.exports = { PostgresEventQueryRepository };
