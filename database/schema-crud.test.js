const { hasTestDatabase, createTestPool } = require("./test-database");
const { withRollback, seedGraph } = require("./test-fixtures");

const WINDOW = "'2099-06-02T00:00:00Z', '2099-06-02T05:00:00Z'";

// Una fila nueva (sin hijos) por tabla: se crea, se lee, se actualiza y se borra.
// insert: SQL con RETURNING *; keys: llave primaria; set: columna y valor del UPDATE.
const TABLES = [
  {
    table: "users",
    keys: ["id_user"],
    insert: () =>
      `INSERT INTO users (id_employee, full_name, email, password_hash, role)
       VALUES ('CRUD-1', 'Crud', 'crud@example.invalid', 'x', 'LOGISTICS') RETURNING *`,
    set: ["full_name", "Editado"],
  },
  {
    table: "blocks",
    keys: ["id_block"],
    insert: (f) =>
      `INSERT INTO blocks (id_user, failed_attempts) VALUES (${f.logistic}, 1) RETURNING *`,
    set: ["failed_attempts", 2],
  },
  {
    table: "password_reset_tokens",
    keys: ["id_token"],
    insert: (f) =>
      `INSERT INTO password_reset_tokens (id_user, token, expiration_date)
       VALUES (${f.logistic}, 'tok-crud', now() + interval '1 hour') RETURNING *`,
    set: ["used", true],
  },
  {
    table: "clients",
    keys: ["id"],
    insert: () =>
      `INSERT INTO clients (full_name, email, phone)
       VALUES ('Cliente CRUD', 'crud-client@example.invalid', '9990000000') RETURNING *`,
    set: ["phone", "9991111111"],
  },
  {
    table: "services",
    keys: ["id"],
    insert: () => "INSERT INTO services (name) VALUES ('Servicio CRUD') RETURNING *",
    set: ["status", "INACTIVE"],
  },
  {
    table: "document_counters",
    keys: ["kind", "year"],
    insert: () =>
      `INSERT INTO document_counters (kind, year, last_number)
       VALUES ('REQUEST_FOLIO', 2099, 1) RETURNING *`,
    set: ["last_number", 2],
  },
  {
    table: "reservations_request",
    keys: ["id"],
    insert: (f) =>
      `INSERT INTO reservations_request
         (folio, client_id, event_date, event_time, event_end_time, guest_count, event_address)
       VALUES ('BD-2099-00002', ${f.client}, '2099-07-01', '12:00', '2099-07-01T23:00:00Z', 50,
         'Jardin') RETURNING *`,
    set: ["guest_count", 120],
    // El alta deja una fila de historial (RESTRICT): se quita antes de borrar la solicitud.
    beforeDelete: (row) => `DELETE FROM request_status_history WHERE request_id = ${row.id}`,
  },
  {
    table: "request_services",
    keys: ["request_id", "service_id"],
    insert: (f) =>
      `INSERT INTO request_services (request_id, service_id)
       VALUES (${f.request}, ${f.service}) RETURNING *`,
    set: ["created_at", new Date("2001-01-01T00:00:00Z")],
  },
  {
    table: "request_status_history",
    keys: ["id"],
    insert: (f) =>
      `INSERT INTO request_status_history (request_id, previous_status, new_status, changed_by_user_id)
       VALUES (${f.request}, 'ASSIGNED', 'COORDINATION_READY', ${f.admin}) RETURNING *`,
    set: ["changed_by_user_id", "logistic"],
  },
  {
    table: "operative_roles",
    keys: ["id"],
    insert: () => "INSERT INTO operative_roles (name) VALUES ('Rol CRUD') RETURNING *",
    set: ["is_active", false],
  },
  {
    table: "resources",
    keys: ["id"],
    insert: () =>
      `INSERT INTO resources (name, type, total_quantity, unit_cost)
       VALUES ('Mesas CRUD', 'LOGISTIC', 3, 99.99) RETURNING *`,
    set: ["total_quantity", 7],
  },
  {
    table: "assigned_resources",
    keys: ["id"],
    insert: (f) =>
      `INSERT INTO assigned_resources (request_id, resource_id, quantity, requested_quantity,
         sufficiency, status, usage_start, usage_end, event_start, event_end)
       VALUES (${f.request}, ${f.material}, 5, 5, 'Suficiente', 'Provisional', ${WINDOW}, ${WINDOW})
       RETURNING *`,
    set: ["quantity", 6],
  },
  {
    table: "resource_confirmations",
    keys: ["id"],
    insert: (f) =>
      `INSERT INTO resource_confirmations (request_id, confirmed_by_user_id, confirmed_at,
         previous_status, resulting_status, sufficient_count, insufficient_count,
         is_fully_sufficient)
       VALUES (${f.request}, ${f.logistic}, now(), 'ASSIGNED', 'COORDINATION_READY', 2, 0, true)
       RETURNING *`,
    set: ["observations", "Todo listo"],
  },
  {
    table: "resource_confirmation_pending_observations",
    keys: ["request_id"],
    insert: (f) =>
      `INSERT INTO resource_confirmation_pending_observations (request_id, observations)
       VALUES (${f.request}, 'pendiente') RETURNING *`,
    set: ["observations", "revisado"],
  },
  {
    table: "derived_information",
    keys: ["id"],
    insert: (f) =>
      `INSERT INTO derived_information (request_id, location, start_datetime, end_datetime)
       VALUES (${f.request}, 'Otro salon', ${WINDOW}) RETURNING *`,
    set: ["location", "Salon editado"],
  },
  {
    table: "proposals",
    keys: ["id"],
    insert: (f) =>
      `INSERT INTO proposals (request_id, derived_information_id, proposal_code, file_name,
         status, version, subtotal, discount_amount, total_amount)
       VALUES (${f.request}, ${f.derived}, 'PROP-2099-0002', 'v2.pdf', 'DRAFT', 2, 100.50, 0.50,
         100.00) RETURNING *`,
    set: ["status", "ACCEPTED"],
  },
  {
    table: "proposal_resources",
    keys: ["proposal_id", "resource_id"],
    insert: (f) =>
      `INSERT INTO proposal_resources (proposal_id, resource_id, quantity, unit_cost)
       VALUES (${f.proposal}, ${f.material}, 10, 12.5) RETURNING *`,
    set: ["quantity", 11],
  },
  {
    table: "proposal_adjustments",
    keys: ["id"],
    insert: (f) =>
      `INSERT INTO proposal_adjustments (proposal_id, observations)
       VALUES (${f.proposal}, 'Mas sillas') RETURNING *`,
    set: ["observations", "Menos sillas"],
  },
  {
    table: "audit_logs",
    keys: ["id"],
    insert: (f) =>
      `INSERT INTO audit_logs (user_id, action, entity_id, new_data)
       VALUES (${f.admin}, 'SEND_PROPOSAL', ${f.proposal}, '{"sent": true}') RETURNING *`,
    set: ["action", "RESEND_PROPOSAL"],
  },
  {
    table: "calendar_events",
    keys: ["id"],
    insert: (f) =>
      `INSERT INTO calendar_events (id_request, title, start_at, end_at, location)
       VALUES (${f.request}, 'Evento CRUD', ${WINDOW}, 'Salon') RETURNING *`,
    set: ["location", "Salon editado"],
  },
  {
    table: "calendar_sync_outbox",
    keys: ["id_outbox"],
    insert: (f) =>
      `INSERT INTO calendar_sync_outbox (calendar_event_id, operation)
       VALUES (${f.event}, 'CREATE') RETURNING *`,
    set: ["status", "DONE"],
  },
];

describe.skipIf(!hasTestDatabase())("schema.sql - CRUD por tabla", () => {
  let pool;

  beforeAll(() => {
    pool = createTestPool();
  });
  afterAll(() => pool.end());

  it("cubre todas las tablas del esquema", async () => {
    const { rows } = await pool.query(
      `SELECT table_name FROM information_schema.tables
       WHERE table_schema = current_schema() AND table_type = 'BASE TABLE' ORDER BY 1`
    );
    expect(TABLES.map((spec) => spec.table).sort()).toEqual(rows.map((row) => row.table_name));
  });

  it.each(TABLES)("$table: crea, lee, actualiza (con updated_at) y borra", (spec) =>
    withRollback(pool, async (db) => {
      const fixtures = await seedGraph(db);
      const created = (await db.query(spec.insert(fixtures))).rows[0];
      const where = spec.keys.map((key, index) => `${key} = $${index + 1}`).join(" AND ");
      const keyValues = spec.keys.map((key) => created[key]);

      const read = await db.query(`SELECT * FROM ${spec.table} WHERE ${where}`, keyValues);
      expect(read.rows).toEqual([created]);

      // updated_at explícito se respeta; un UPDATE sin él lo mueve a now().
      await db.query(
        `UPDATE ${spec.table} SET updated_at = '2000-01-01T00:00:00Z' WHERE ${where}`,
        keyValues
      );
      const [column, rawValue] = spec.set;
      const value = rawValue === "logistic" ? fixtures.logistic : rawValue;
      const updated = (
        await db.query(
          `UPDATE ${spec.table} SET ${column} = $${keyValues.length + 1} WHERE ${where}
           RETURNING *, updated_at = now() AS touched`,
          [...keyValues, value]
        )
      ).rows[0];
      expect(updated[column] instanceof Date ? updated[column] : String(updated[column])).toEqual(
        value instanceof Date ? value : String(value)
      );
      expect(updated.touched).toBe(true);

      if (spec.beforeDelete) await db.query(spec.beforeDelete(created));
      const deleted = await db.query(`DELETE FROM ${spec.table} WHERE ${where}`, keyValues);
      expect(deleted.rowCount).toBe(1);
      expect(
        (await db.query(`SELECT 1 FROM ${spec.table} WHERE ${where}`, keyValues)).rowCount
      ).toBe(0);
    })
  );
});
