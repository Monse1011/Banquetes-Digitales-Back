const { hasTestDatabase, createTestPool } = require("./test-database");
const { withRollback, pgError, seedGraph } = require("./test-fixtures");

const FK_VIOLATION = "23503";
const UNIQUE_VIOLATION = "23505";
const NOT_NULL_VIOLATION = "23502";
const CHECK_VIOLATION = "23514";
const WINDOW = "'2099-06-02T00:00:00Z', '2099-06-02T05:00:00Z'";

// Cada caso: [descripción, (fixtures) => SQL que debe fallar].
const INVALID_FOREIGN_KEYS = [
  ["blocks.id_user", () => "INSERT INTO blocks (id_user) VALUES (-1)"],
  [
    "password_reset_tokens.id_user",
    () =>
      "INSERT INTO password_reset_tokens (id_user, token, expiration_date) VALUES (-1, 't', now())",
  ],
  [
    "reservations_request.client_id",
    () =>
      `INSERT INTO reservations_request (folio, client_id, event_date, event_time, guest_count,
         event_address) VALUES ('BD-2099-00009', -1, '2099-01-01', '10:00', 1, 'x')`,
  ],
  [
    "reservations_request.logistic_user_id",
    (f) => `UPDATE reservations_request SET logistic_user_id = -1 WHERE id = ${f.request}`,
  ],
  [
    "request_services.service_id",
    (f) => `INSERT INTO request_services (request_id, service_id) VALUES (${f.request}, -1)`,
  ],
  [
    "request_status_history.request_id",
    () => "INSERT INTO request_status_history (request_id, new_status) VALUES (-1, 'PENDING')",
  ],
  [
    "resources.operative_role_id",
    () =>
      `INSERT INTO resources (name, type, operative_role_id, total_quantity)
       VALUES ('x', 'HUMAN', -1, 1)`,
  ],
  [
    "assigned_resources.resource_id",
    (f) =>
      `INSERT INTO assigned_resources (request_id, resource_id, quantity, requested_quantity,
         status, usage_start, usage_end, event_start, event_end)
       VALUES (${f.request}, -1, 1, 1, 'Provisional', ${WINDOW}, ${WINDOW})`,
  ],
  [
    "resource_confirmations.request_id",
    () =>
      `INSERT INTO resource_confirmations (request_id, confirmed_at, previous_status,
         resulting_status, sufficient_count, insufficient_count, is_fully_sufficient)
       VALUES (-1, now(), 'ASSIGNED', 'COORDINATION_READY', 1, 0, true)`,
  ],
  [
    "resource_confirmation_pending_observations.request_id",
    () =>
      "INSERT INTO resource_confirmation_pending_observations (request_id, observations) VALUES (-1, 'x')",
  ],
  [
    "derived_information.request_id",
    () =>
      `INSERT INTO derived_information (request_id, location, start_datetime, end_datetime)
       VALUES (-1, 'x', ${WINDOW})`,
  ],
  [
    "proposals: acuerdos de otra solicitud (FK compuesta)",
    (f) =>
      `WITH other AS (
         INSERT INTO reservations_request (folio, client_id, event_date, event_time, guest_count,
           event_address) VALUES ('BD-2099-00008', ${f.client}, '2099-01-01', '10:00', 1, 'x')
         RETURNING id)
       INSERT INTO proposals (request_id, derived_information_id, proposal_code, file_name,
         status, subtotal, total_amount)
       SELECT id, ${f.derived}, 'PROP-X', 'x.pdf', 'DRAFT', 0, 0 FROM other`,
  ],
  [
    "proposal_resources.resource_id",
    (f) =>
      `INSERT INTO proposal_resources (proposal_id, resource_id, quantity, unit_cost)
       VALUES (${f.proposal}, -1, 1, 1)`,
  ],
  [
    "proposal_adjustments.proposal_id",
    () => "INSERT INTO proposal_adjustments (proposal_id, observations) VALUES (-1, 'x')",
  ],
  ["audit_logs.user_id", () => "INSERT INTO audit_logs (user_id, action) VALUES (-1, 'X')"],
  [
    "calendar_events.id_request",
    () =>
      `INSERT INTO calendar_events (id_request, title, start_at, end_at, location)
       VALUES (-1, 't', ${WINDOW}, 'x')`,
  ],
  [
    "calendar_sync_outbox.calendar_event_id",
    () => "INSERT INTO calendar_sync_outbox (calendar_event_id, operation) VALUES (-1, 'CREATE')",
  ],
];

const DUPLICATES = [
  [
    "users.id_employee",
    () =>
      `INSERT INTO users (id_employee, full_name, email, password_hash, role)
       VALUES ('FX-A', 'x', 'otro@example.invalid', 'x', 'ADMIN')`,
  ],
  [
    "users.email sin distinguir mayúsculas",
    () =>
      `INSERT INTO users (id_employee, full_name, email, password_hash, role)
       VALUES ('X-1', 'x', 'FX-ADMIN@example.invalid', 'x', 'ADMIN')`,
  ],
  [
    "clients.email",
    () =>
      "INSERT INTO clients (full_name, email, phone) VALUES ('x', 'fx-client@example.invalid', '1')",
  ],
  ["services.name", () => "INSERT INTO services (name) VALUES ('Servicio FX')"],
  [
    "operative_roles.name sin distinguir mayúsculas ni espacios",
    () => "INSERT INTO operative_roles (name) VALUES ('  rol fx ')",
  ],
  [
    "reservations_request.folio",
    (f) =>
      `INSERT INTO reservations_request (folio, client_id, event_date, event_time, guest_count,
         event_address) VALUES ('BD-2099-00001', ${f.client}, '2099-01-01', '10:00', 1, 'x')`,
  ],
  ["blocks.id_user", (f) => `INSERT INTO blocks (id_user) VALUES (${f.admin}), (${f.admin})`],
  [
    "password_reset_tokens.token",
    (f) =>
      `INSERT INTO password_reset_tokens (id_user, token, expiration_date)
       VALUES (${f.admin}, 'dup', now()), (${f.admin}, 'dup', now())`,
  ],
  [
    "document_counters (kind, year)",
    () =>
      `INSERT INTO document_counters (kind, year, last_number)
       VALUES ('PROPOSAL_CODE', 2099, 1), ('PROPOSAL_CODE', 2099, 2)`,
  ],
  [
    "request_services (request_id, service_id)",
    (f) =>
      `INSERT INTO request_services (request_id, service_id)
       VALUES (${f.request}, ${f.service}), (${f.request}, ${f.service})`,
  ],
  [
    "proposals (request_id, version)",
    (f) =>
      `INSERT INTO proposals (request_id, derived_information_id, proposal_code, file_name,
         status, version, subtotal, total_amount)
       VALUES (${f.request}, ${f.derived}, 'PROP-2099-0099', 'x.pdf', 'DRAFT', 1, 0, 0)`,
  ],
  [
    "proposals.proposal_code",
    (f) =>
      `INSERT INTO proposals (request_id, derived_information_id, proposal_code, file_name,
         status, version, subtotal, total_amount)
       VALUES (${f.request}, ${f.derived}, 'PROP-2099-0001', 'x.pdf', 'DRAFT', 2, 0, 0)`,
  ],
  [
    "proposal_resources (proposal_id, resource_id)",
    (f) =>
      `INSERT INTO proposal_resources (proposal_id, resource_id, quantity, unit_cost)
       VALUES (${f.proposal}, ${f.material}, 1, 1), (${f.proposal}, ${f.material}, 2, 1)`,
  ],
  [
    "resource_confirmation_pending_observations.request_id",
    (f) =>
      `INSERT INTO resource_confirmation_pending_observations (request_id, observations)
       VALUES (${f.request}, 'a'), (${f.request}, 'b')`,
  ],
  [
    "calendar_events.google_event_id",
    (f) =>
      `INSERT INTO calendar_events (id_request, title, start_at, end_at, location, google_event_id)
       VALUES (${f.request}, 'a', ${WINDOW}, 'x', 'g-1'), (${f.request}, 'b', ${WINDOW}, 'x', 'g-1')`,
  ],
];

const NULLS = [
  [
    "users.password_hash",
    (f) => `UPDATE users SET password_hash = NULL WHERE id_user = ${f.admin}`,
  ],
  ["clients.phone", (f) => `UPDATE clients SET phone = NULL WHERE id = ${f.client}`],
  [
    "reservations_request.event_date",
    (f) => `UPDATE reservations_request SET event_date = NULL WHERE id = ${f.request}`,
  ],
  [
    "reservations_request.status",
    (f) => `UPDATE reservations_request SET status = NULL WHERE id = ${f.request}`,
  ],
  [
    "request_status_history.new_status",
    (f) => `INSERT INTO request_status_history (request_id) VALUES (${f.request})`,
  ],
  ["resources.name", (f) => `UPDATE resources SET name = NULL WHERE id = ${f.material}`],
  [
    "assigned_resources.event_start",
    (f) =>
      `INSERT INTO assigned_resources (request_id, resource_id, quantity, requested_quantity,
         status, usage_start, usage_end, event_end)
       VALUES (${f.request}, ${f.material}, 1, 1, 'Provisional', ${WINDOW}, '2099-06-02T05:00:00Z')`,
  ],
  [
    "derived_information.location",
    (f) => `UPDATE derived_information SET location = NULL WHERE id = ${f.derived}`,
  ],
  ["proposals.subtotal", (f) => `UPDATE proposals SET subtotal = NULL WHERE id = ${f.proposal}`],
  [
    "calendar_events.location",
    (f) => `UPDATE calendar_events SET location = NULL WHERE id = ${f.event}`,
  ],
  [
    "calendar_sync_outbox.operation",
    (f) => `INSERT INTO calendar_sync_outbox (calendar_event_id) VALUES (${f.event})`,
  ],
];

const CHECKS = [
  ["users.role desconocido", (f) => `UPDATE users SET role = 'ROOT' WHERE id_user = ${f.admin}`],
  [
    "reservations_request.status fuera del DAD",
    (f) => `UPDATE reservations_request SET status = 'Pendiente' WHERE id = ${f.request}`,
  ],
  [
    "reservations_request.folio con formato inválido",
    (f) => `UPDATE reservations_request SET folio = 'FOLIO-1' WHERE id = ${f.request}`,
  ],
  [
    "reservations_request fin antes del inicio",
    (f) =>
      `UPDATE reservations_request SET event_end_time = '2099-06-01T00:00:00Z' WHERE id = ${f.request}`,
  ],
  [
    "reservations_request.guest_count = 0",
    (f) => `UPDATE reservations_request SET guest_count = 0 WHERE id = ${f.request}`,
  ],
  [
    "resources.type en español (heredado)",
    (f) => `UPDATE resources SET type = 'humano' WHERE id = ${f.human}`,
  ],
  [
    "resources HUMAN sin rol operativo",
    (f) => `UPDATE resources SET operative_role_id = NULL WHERE id = ${f.human}`,
  ],
  [
    "resources MATERIAL con rol operativo",
    (f) => `UPDATE resources SET operative_role_id = ${f.role} WHERE id = ${f.material}`,
  ],
  [
    "resources inactivo sin deactivated_at",
    (f) => `UPDATE resources SET is_active = false WHERE id = ${f.material}`,
  ],
  [
    "assigned_resources 'Liberada' sin released_at",
    (f) =>
      `INSERT INTO assigned_resources (request_id, resource_id, quantity, requested_quantity,
         status, usage_start, usage_end, event_start, event_end)
       VALUES (${f.request}, ${f.material}, 1, 1, 'Liberada', ${WINDOW}, ${WINDOW})`,
  ],
  [
    "resource_confirmations.is_fully_sufficient contradictorio",
    (f) =>
      `INSERT INTO resource_confirmations (request_id, confirmed_at, previous_status,
         resulting_status, sufficient_count, insufficient_count, is_fully_sufficient)
       VALUES (${f.request}, now(), 'ASSIGNED', 'COORDINATION_INCOMPLETE', 1, 2, true)`,
  ],
  [
    "proposals descuento mayor al subtotal",
    (f) => `UPDATE proposals SET discount_amount = 999 WHERE id = ${f.proposal}`,
  ],
  [
    "proposals.status en minúsculas",
    (f) => `UPDATE proposals SET status = 'accepted' WHERE id = ${f.proposal}`,
  ],
  [
    "calendar_events.sync_status desconocido",
    (f) => `UPDATE calendar_events SET sync_status = 'DONE' WHERE id = ${f.event}`,
  ],
  [
    "calendar_sync_outbox.operation en minúsculas",
    (f) =>
      `INSERT INTO calendar_sync_outbox (calendar_event_id, operation) VALUES (${f.event}, 'create')`,
  ],
  [
    "document_counters.kind desconocido",
    () => "INSERT INTO document_counters (kind, year, last_number) VALUES ('X', 2099, 1)",
  ],
];

describe.skipIf(!hasTestDatabase())("schema.sql - integridad", () => {
  let pool;

  beforeAll(() => {
    pool = createTestPool();
  });
  afterAll(() => pool.end());

  const expectError = (code) => async (_, sql) =>
    withRollback(pool, async (db) => {
      const error = await pgError(db, sql(await seedGraph(db)));
      expect(error?.code, error?.message ?? "la sentencia no falló").toBe(code);
    });

  describe("rechaza llaves foráneas inválidas", () => {
    it.each(INVALID_FOREIGN_KEYS)("%s", expectError(FK_VIOLATION));
  });

  describe("rechaza duplicados en columnas UNIQUE", () => {
    it.each(DUPLICATES)("%s", expectError(UNIQUE_VIOLATION));
  });

  describe("respeta NOT NULL", () => {
    it.each(NULLS)("%s", expectError(NOT_NULL_VIOLATION));
  });

  describe("respeta las restricciones CHECK", () => {
    it.each(CHECKS)("%s", expectError(CHECK_VIOLATION));

    it("nombra chk_reservations_request_actual_window (lo espera la Función 3.6)", () =>
      withRollback(pool, async (db) => {
        const f = await seedGraph(db);
        const error = await pgError(
          db,
          `UPDATE reservations_request SET actual_start_at = now(),
             actual_end_at = now() - interval '1 hour' WHERE id = $1`,
          [f.request]
        );
        expect(error?.constraint).toBe("chk_reservations_request_actual_window");
      }));
  });

  describe("ON DELETE", () => {
    it("CASCADE: borrar un usuario elimina sus bloqueos y tokens", () =>
      withRollback(pool, async (db) => {
        const user = (
          await db.query(
            `INSERT INTO users (id_employee, full_name, email, password_hash, role)
             VALUES ('DEL-1', 'x', 'del@example.invalid', 'x', 'LOGISTICS') RETURNING id_user`
          )
        ).rows[0].id_user;
        await db.query("INSERT INTO blocks (id_user) VALUES ($1)", [user]);
        await db.query(
          "INSERT INTO password_reset_tokens (id_user, token, expiration_date) VALUES ($1, 'del', now())",
          [user]
        );

        await db.query("DELETE FROM users WHERE id_user = $1", [user]);

        const left = await db.query(
          `SELECT (SELECT count(*) FROM blocks WHERE id_user = $1)
                + (SELECT count(*) FROM password_reset_tokens WHERE id_user = $1) AS total`,
          [user]
        );
        expect(Number(left.rows[0].total)).toBe(0);
      }));

    it("CASCADE: borrar una propuesta elimina sus líneas y observaciones", () =>
      withRollback(pool, async (db) => {
        const f = await seedGraph(db);
        await db.query(
          "INSERT INTO proposal_resources (proposal_id, resource_id, quantity, unit_cost) VALUES ($1, $2, 1, 1)",
          [f.proposal, f.material]
        );
        await db.query(
          "INSERT INTO proposal_adjustments (proposal_id, observations) VALUES ($1, 'x')",
          [f.proposal]
        );

        await db.query("DELETE FROM proposals WHERE id = $1", [f.proposal]);

        const left = await db.query(
          `SELECT (SELECT count(*) FROM proposal_resources WHERE proposal_id = $1)
                + (SELECT count(*) FROM proposal_adjustments WHERE proposal_id = $1) AS total`,
          [f.proposal]
        );
        expect(Number(left.rows[0].total)).toBe(0);
      }));

    it("CASCADE: borrar un evento elimina su cola de sincronización", () =>
      withRollback(pool, async (db) => {
        const f = await seedGraph(db);
        await db.query(
          "INSERT INTO calendar_sync_outbox (calendar_event_id, operation) VALUES ($1, 'CREATE')",
          [f.event]
        );

        await db.query("DELETE FROM calendar_events WHERE id = $1", [f.event]);

        const left = await db.query(
          "SELECT count(*) FROM calendar_sync_outbox WHERE calendar_event_id = $1",
          [f.event]
        );
        expect(Number(left.rows[0].count)).toBe(0);
      }));

    it("RESTRICT: el historial impide borrar la solicitud; sin él, se borran sus detalles", () =>
      withRollback(pool, async (db) => {
        const f = await seedGraph(db);
        const request = (
          await db.query(
            `INSERT INTO reservations_request (folio, client_id, event_date, event_time,
               guest_count, event_address)
             VALUES ('BD-2099-00003', $1, '2099-01-01', '10:00', 1, 'x') RETURNING id`,
            [f.client]
          )
        ).rows[0].id;
        await db.query("INSERT INTO request_services (request_id, service_id) VALUES ($1, $2)", [
          request,
          f.service,
        ]);
        await db.query(
          "INSERT INTO resource_confirmation_pending_observations (request_id, observations) VALUES ($1, 'x')",
          [request]
        );

        const blocked = await pgError(db, "DELETE FROM reservations_request WHERE id = $1", [
          request,
        ]);
        expect(blocked?.code).toBe(FK_VIOLATION);
        expect(blocked?.table).toBe("request_status_history");

        await db.query("DELETE FROM request_status_history WHERE request_id = $1", [request]);
        await db.query("DELETE FROM reservations_request WHERE id = $1", [request]);
        const left = await db.query(
          `SELECT (SELECT count(*) FROM request_services WHERE request_id = $1)
                + (SELECT count(*) FROM resource_confirmation_pending_observations
                   WHERE request_id = $1) AS total`,
          [request]
        );
        expect(Number(left.rows[0].total)).toBe(0);
      }));

    it.each([
      ["un cliente con solicitudes", (f) => `DELETE FROM clients WHERE id = ${f.client}`],
      ["un usuario responsable", (f) => `DELETE FROM users WHERE id_user = ${f.logistic}`],
      ["un rol operativo en uso", (f) => `DELETE FROM operative_roles WHERE id = ${f.role}`],
      [
        "acuerdos usados por una propuesta",
        (f) => `DELETE FROM derived_information WHERE id = ${f.derived}`,
      ],
      [
        "un servicio solicitado",
        (f) =>
          `WITH used AS (INSERT INTO request_services VALUES (${f.request}, ${f.service}))
           DELETE FROM services WHERE id = ${f.service}`,
      ],
    ])("RESTRICT: no permite borrar %s", expectError(FK_VIOLATION));
  });

  describe("columnas derivadas y triggers", () => {
    it("event_date_time se deriva de la fecha y hora de Mérida y no se puede escribir", () =>
      withRollback(pool, async (db) => {
        const f = await seedGraph(db);
        const row = (
          await db.query("SELECT event_date_time FROM reservations_request WHERE id = $1", [
            f.request,
          ])
        ).rows[0];
        expect(row.event_date_time.toISOString()).toBe("2099-06-02T00:00:00.000Z");

        const error = await pgError(
          db,
          "UPDATE reservations_request SET event_date_time = now() WHERE id = $1",
          [f.request]
        );
        expect(error?.code).toBe("428C9");
      }));

    it("un cambio de estado fija status_changed_at y deja historial con su autor", () =>
      withRollback(pool, async (db) => {
        const f = await seedGraph(db);
        await db.query(
          "UPDATE reservations_request SET status_changed_at = '2000-01-01' WHERE id = $1",
          [f.request]
        );
        await db.query("SELECT set_config('app.current_user_id', $1, true)", [String(f.admin)]);
        await db.query(
          "UPDATE reservations_request SET status = 'COORDINATION_READY' WHERE id = $1",
          [f.request]
        );

        const request = await db.query(
          "SELECT status_changed_at = now() AS touched FROM reservations_request WHERE id = $1",
          [f.request]
        );
        expect(request.rows[0].touched).toBe(true);
        const history = await db.query(
          `SELECT previous_status, new_status, changed_by_user_id
           FROM request_status_history WHERE request_id = $1 ORDER BY id`,
          [f.request]
        );
        expect(history.rows).toEqual([
          { previous_status: null, new_status: "ASSIGNED", changed_by_user_id: null },
          {
            previous_status: "ASSIGNED",
            new_status: "COORDINATION_READY",
            changed_by_user_id: String(f.admin),
          },
        ]);
      }));

    it("el historial manual de changeStatusAtomic no se duplica con el del trigger", () =>
      withRollback(pool, async (db) => {
        const f = await seedGraph(db);
        const changedAt = new Date("2099-01-01T12:00:00.123Z");
        // Las mismas dos sentencias que PostgresReservationRequestRepository.changeStatusAtomic.
        await db.query(
          "UPDATE reservations_request SET status = $1, status_changed_at = $2 WHERE id = $3",
          ["IN_REVIEW", changedAt, f.request]
        );
        await db.query(
          `INSERT INTO request_status_history
             (request_id, previous_status, new_status, changed_by_user_id, changed_at)
           VALUES ($1, $2, $3, $4, $5)`,
          [f.request, "ASSIGNED", "IN_REVIEW", f.logistic, changedAt]
        );

        const history = await db.query(
          `SELECT changed_by_user_id, changed_at FROM request_status_history
           WHERE request_id = $1 AND new_status = 'IN_REVIEW'`,
          [f.request]
        );
        expect(history.rows).toEqual([
          { changed_by_user_id: String(f.logistic), changed_at: changedAt },
        ]);
      }));
  });
});
