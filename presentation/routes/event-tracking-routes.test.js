const { Pool } = require("pg");
const request = require("supertest");
const { createApp } = require("../app");
const {
  PostgresEventQueryRepository,
} = require("../../infrastructure/repositories/event-tracking/postgres-event-query-repository");
const {
  ListFinishedEventsUseCase,
} = require("../../application/use-cases/event-tracking/list-finished-events-use-case");
const {
  GetFinishedEventUseCase,
} = require("../../application/use-cases/event-tracking/get-finished-event-use-case");
const { EventTrackingMessages } = require("../../domain/constants/event-tracking-messages");
const UserRole = require("../../domain/enums/auth/user-role");

const AUTH_COOKIE = "auth_token=valid-token";
const notUsed = (_req, res) => res.sendStatus(501);

function buildApp(role, connection = null) {
  const repository = new PostgresEventQueryRepository(connection);
  return createApp({
    authController: {
      session: notUsed,
      logout: notUsed,
      login: notUsed,
      changePassword: notUsed,
      firstAccess: notUsed,
    },
    passwordResetController: { requestReset: notUsed, resetPassword: notUsed },
    tokenService: { verifyToken: () => ({ id_user: 1, role }) },
    resourceUseCases: {},
    humanResourceUseCases: {},
    materialResourceUseCases: {},
    logisticResourceUseCases: {},
    listFinishedEventsUseCase: new ListFinishedEventsUseCase(repository),
    getFinishedEventUseCase: new GetFinishedEventUseCase(repository),
  });
}

const ENDPOINTS = ["/api/admin/finished-events", "/api/admin/finished-events/1"];

describe("Event tracking routes: access (Funciones 2.11 y 2.5)", () => {
  it.each(ENDPOINTS)("rejects LOGISTICS users on GET %s", async (url) => {
    const response = await request(buildApp(UserRole.LOGISTICS))
      .get(url)
      .set("Cookie", AUTH_COOKIE);
    expect(response.status).toBe(403);
  });

  it.each(ENDPOINTS)("rejects requests without session on GET %s", async (url) => {
    expect((await request(buildApp(UserRole.ADMIN)).get(url)).status).toBe(401);
  });

  it.each(
    ENDPOINTS.flatMap((url) => ["post", "put", "patch", "delete"].map((method) => [method, url]))
  )("exposes no %s endpoint on %s (read-only)", async (method, url) => {
    const response = await request(buildApp(UserRole.ADMIN))
      [method](url)
      .set("Cookie", AUTH_COOKIE)
      .send({});
    expect(response.status).toBe(404);
  });
});

// Opt-in: TEST_PGDATABASE debe nombrar la base de pruebas (nunca la de desarrollo). Cada prueba
// inserta sus datos dentro de una transacción que se revierte al terminar.
describe.skipIf(!process.env.TEST_PGDATABASE)("Event tracking routes against PostgreSQL", () => {
  let pool;
  let connection;
  let app;
  let sequence = 0;

  beforeAll(() => {
    if (process.env.TEST_PGDATABASE === process.env.PGDATABASE) {
      throw new Error("TEST_PGDATABASE must not be the development database");
    }
    pool = new Pool({ database: process.env.TEST_PGDATABASE });
  });

  afterAll(() => pool.end());

  beforeEach(async () => {
    connection = await pool.connect();
    await connection.query("BEGIN");
    app = buildApp(UserRole.ADMIN, connection);
  });

  afterEach(async () => {
    await connection.query("ROLLBACK");
    connection.release();
  });

  const get = (url, query = {}) => request(app).get(url).query(query).set("Cookie", AUTH_COOKIE);

  async function insertUser(role, fullName) {
    sequence += 1;
    const { rows } = await connection.query(
      `INSERT INTO users (id_employee, full_name, email, password_hash, role)
       VALUES ($1, $2, $3, 'unused-test-hash', $4) RETURNING id_user`,
      [`TEST-${sequence}`, fullName, `user-${sequence}@example.invalid`, role]
    );
    return Number(rows[0].id_user);
  }

  async function insertClient(fullName) {
    sequence += 1;
    const { rows } = await connection.query(
      "INSERT INTO clients (full_name, email, phone) VALUES ($1, $2, '9991234567') RETURNING id",
      [fullName, `client-${sequence}@example.invalid`]
    );
    return Number(rows[0].id);
  }

  // Fecha y horas en hora de Mérida; folios del año 9999 para no chocar con datos reales.
  async function insertRequest({ clientId, status, date, start = "18:00", end = "23:00", users }) {
    sequence += 1;
    const folio = `BD-9999-${String(sequence).padStart(5, "0")}`;
    const { rows } = await connection.query(
      `INSERT INTO reservations_request
         (folio, client_id, event_date, event_time, event_end_time, guest_count, event_address,
          status, request_date, logistic_user_id, assigned_by_user_id, assigned_at)
       VALUES ($1, $2, $3::date, $4::time, ($3::date + $5::time) AT TIME ZONE 'America/Merida',
         80, 'Hacienda de prueba, Mérida', $6, '2020-01-01', $7, $8, '2020-01-02')
       RETURNING id`,
      [folio, clientId, date, start, end, status, users.logistic, users.admin]
    );
    return { id: Number(rows[0].id), folio };
  }

  async function insertResource(type, name, quantity, requestId, status = "CONFIRMED") {
    const role =
      type === "HUMAN"
        ? (await connection.query("SELECT id, name FROM operative_roles LIMIT 1")).rows[0]
        : null;
    const { rows } = await connection.query(
      `INSERT INTO resources (name, type, operative_role_id, total_quantity, unit_cost)
       VALUES ($1, $2, $3, 100, $4) RETURNING id`,
      [name, type, role?.id ?? null, type === "HUMAN" ? null : 10]
    );
    await connection.query(
      `INSERT INTO assigned_resources (request_id, resource_id, requested_quantity, quantity,
         sufficiency, usage_start, usage_end, status, released_at)
       VALUES ($1, $2, $3, $3, 'SUFFICIENT', '2020-03-01T18:00:00Z', '2020-03-01T23:00:00Z',
         $4::varchar, CASE WHEN $4::varchar = 'RELEASED' THEN NOW() END)`,
      [requestId, rows[0].id, quantity, status]
    );
    return role?.name ?? null;
  }

  async function seedUsers() {
    return {
      admin: await insertUser("ADMIN", "Admin Prueba"),
      logistic: await insertUser("LOGISTICS", "Lucía Logística"),
    };
  }

  describe("Función 2.11 - Consulta de eventos finalizados", () => {
    it("RF-1.2.11.1 lists only finished events with folio, client name and event date", async () => {
      const users = await seedUsers();
      const clientId = await insertClient("Zafiro Finalizado");
      const finished = await insertRequest({
        clientId,
        status: "FINISHED",
        date: "2025-03-01",
        users,
      });
      const confirmed = await insertRequest({
        clientId,
        status: "CONFIRMED",
        date: "2025-04-01",
        users,
      });

      const response = await get("/api/admin/finished-events", { per_page: "100" });

      expect(response.status).toBe(200);
      expect(response.body.data.events).toContainEqual({
        request_id: finished.id,
        folio: finished.folio,
        client_name: "Zafiro Finalizado",
        event_date: "2025-03-01",
      });
      const ids = response.body.data.events.map((event) => event.request_id);
      expect(ids).not.toContain(confirmed.id);
      expect(response.body.message).toBeUndefined();
    });

    it("RF-1.2.11.2 shows the read-only detail with client, place, staff and resources", async () => {
      const users = await seedUsers();
      const clientId = await insertClient("Zafiro Detalle");
      const event = await insertRequest({
        clientId,
        status: "FINISHED",
        date: "2025-03-01",
        start: "17:30",
        end: "22:00",
        users,
      });
      const roleName = await insertResource("HUMAN", "Mesero Prueba", 1, event.id);
      await insertResource("MATERIAL", "Mantel Prueba", 20, event.id);
      await insertResource("LOGISTIC", "Camioneta liberada", 1, event.id, "RELEASED");

      const response = await get(`/api/admin/finished-events/${event.id}`);

      expect(response.status).toBe(200);
      expect(response.body.data).toEqual({
        request_id: event.id,
        folio: event.folio,
        status: "Finalizado",
        client: {
          name: "Zafiro Detalle",
          email: expect.stringContaining("@example.invalid"),
          phone: "9991234567",
        },
        event: {
          date: "2025-03-01",
          start_time: "17:30",
          end_time: "22:00",
          address: "Hacienda de prueba, Mérida",
          guest_count: 80,
        },
        logistic_user: {
          name: "Lucía Logística",
          email: expect.stringContaining("@example.invalid"),
        },
        resources: [
          { type: "HUMAN", name: "Mesero Prueba", operative_role: roleName, quantity: 1 },
          { type: "MATERIAL", name: "Mantel Prueba", operative_role: null, quantity: 20 },
        ],
        actual_start_time: null,
        actual_end_time: null,
        event_observations: null,
      });
    });

    it("RF-1.2.11.2 does not show the detail of an event that is not finished", async () => {
      const users = await seedUsers();
      const clientId = await insertClient("Zafiro Activo");
      const active = await insertRequest({
        clientId,
        status: "CONFIRMED",
        date: "2025-03-01",
        users,
      });

      const response = await get(`/api/admin/finished-events/${active.id}`);
      expect(response.status).toBe(404);
      expect(response.body.message).toBe(EventTrackingMessages.FINISHED_EVENT_NOT_FOUND);
      expect((await get("/api/admin/finished-events/abc")).status).toBe(400);
    });

    it("RF-1.2.11.3 filters by client name, by folio and by event date range combined", async () => {
      const users = await seedUsers();
      const ana = await insertClient("Zafiro Ana Filtro");
      const beto = await insertClient("Zafiro Beto Filtro");
      const anaMarch = await insertRequest({
        clientId: ana,
        status: "FINISHED",
        date: "2025-03-10",
        users,
      });
      const anaJune = await insertRequest({
        clientId: ana,
        status: "FINISHED",
        date: "2025-06-10",
        users,
      });
      const betoMarch = await insertRequest({
        clientId: beto,
        status: "FINISHED",
        date: "2025-03-15",
        users,
      });
      const folios = async (query) =>
        (await get("/api/admin/finished-events", query)).body.data.events.map((e) => e.folio);

      expect(await folios({ search: "zafiro ana" })).toEqual([anaJune.folio, anaMarch.folio]);
      expect(await folios({ search: betoMarch.folio })).toEqual([betoMarch.folio]);
      expect(await folios({ search: "Zafiro", from: "2025-03-01", to: "2025-03-31" })).toEqual([
        betoMarch.folio,
        anaMarch.folio,
      ]);
      expect(await folios({ search: "Ana Filtro", from: "2025-03-10", to: "2025-03-10" })).toEqual([
        anaMarch.folio,
      ]);
    });

    it("RF-1.2.11.4 returns the no-results message when filters match nothing", async () => {
      const users = await seedUsers();
      const clientId = await insertClient("Zafiro Sin Resultados");
      await insertRequest({ clientId, status: "FINISHED", date: "2025-03-01", users });

      const response = await get("/api/admin/finished-events", {
        search: "Zafiro Sin Resultados",
        from: "2025-04-01",
      });

      expect(response.status).toBe(200);
      expect(response.body.data.events).toEqual([]);
      expect(response.body.message).toBe(EventTrackingMessages.FINISHED_EVENTS_NOT_FOUND);
    });

    it("RF-1.2.11.3 rejects invalid dates and inverted ranges", async () => {
      const invalid = await get("/api/admin/finished-events", { from: "2025-02-30" });
      expect(invalid.status).toBe(400);
      expect(invalid.body.message).toBe(EventTrackingMessages.DATE_INVALID);

      const inverted = await get("/api/admin/finished-events", {
        from: "2025-03-02",
        to: "2025-03-01",
      });
      expect(inverted.status).toBe(400);
      expect(inverted.body.message).toBe(EventTrackingMessages.DATE_RANGE_INVALID);
    });
  });
});
