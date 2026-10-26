const { Pool } = require("pg");
const request = require("supertest");
const { createApp } = require("../app");
const {
  PostgresAdminRequestQueryRepository,
} = require("../../infrastructure/repositories/reservation-request/postgres-admin-request-query-repository");
const {
  GetReservationRequestsUseCase,
} = require("../../application/use-cases/reservation-request/get-reservation-requests-use-case");
const {
  GetReservationRequestUseCase,
} = require("../../application/use-cases/reservation-request/get-reservation-request-use-case");
const { AdminRequestMessages } = require("../../domain/constants/admin-request-messages");
const UserRole = require("../../domain/enums/auth/user-role");
const { AssignmentStatus } = require("../../domain/enums/resource-assignment/assignment-status");
const {
  ResourceSufficiency,
} = require("../../domain/enums/resource-assignment/resource-sufficiency");

const AUTH_COOKIE = "auth_token=valid-token";
const notUsed = (_req, res) => res.sendStatus(501);

function buildApp(role, connection = null) {
  const repository = new PostgresAdminRequestQueryRepository(connection);
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
    getReservationRequestsUseCase: new GetReservationRequestsUseCase(repository),
    getReservationRequestUseCase: new GetReservationRequestUseCase(repository),
  });
}

const LIST = "/api/admin/requests";
const ENDPOINTS = [LIST, `${LIST}/1`];

describe("GET /api/admin/requests: access and validation (Funciones 2.5 y 2.11)", () => {
  const admin = () => buildApp(UserRole.ADMIN);
  const list = (query) => request(admin()).get(LIST).query(query).set("Cookie", AUTH_COOKIE);

  it.each(ENDPOINTS)("RF-1.2.5.1 rejects LOGISTICS users on GET %s", async (url) => {
    const response = await request(buildApp(UserRole.LOGISTICS))
      .get(url)
      .set("Cookie", AUTH_COOKIE);
    expect(response.status).toBe(403);
  });

  it.each(ENDPOINTS)("rejects requests without session on GET %s", async (url) => {
    expect((await request(admin()).get(url)).status).toBe(401);
  });

  // PATCH /requests/:id y /requests/:id/assignment pertenecen a la Función 2.4.
  it.each(ENDPOINTS.flatMap((url) => ["post", "put", "delete"].map((method) => [method, url])))(
    "exposes no %s endpoint on %s (read-only)",
    async (method, url) => {
      const response = await request(admin())[method](url).set("Cookie", AUTH_COOKIE).send({});
      expect(response.status).toBe(404);
    }
  );

  it.each([
    [{ page: "0" }, AdminRequestMessages.PAGINATION_INVALID],
    [{ page: "abc" }, AdminRequestMessages.PAGINATION_INVALID],
    [{ per_page: "101" }, AdminRequestMessages.PAGINATION_INVALID],
    [{ status: "FINISHED" }, AdminRequestMessages.STATUS_INVALID],
    [{ status: "finalized" }, AdminRequestMessages.STATUS_INVALID],
    [{ active: "true", status: "FINALIZED" }, AdminRequestMessages.STATUS_INVALID],
    [{ active: "yes" }, AdminRequestMessages.STATUS_INVALID],
    [{ logistic_user_id: "abc" }, AdminRequestMessages.LOGISTIC_USER_ID_INVALID],
    [{ logistic_user_id: "0" }, AdminRequestMessages.LOGISTIC_USER_ID_INVALID],
    [{ event_date_from: "2025-02-30" }, AdminRequestMessages.DATE_INVALID],
    [{ event_date_to: "15/03/2025" }, AdminRequestMessages.DATE_INVALID],
    [
      { event_date_from: "2025-03-02", event_date_to: "2025-03-01" },
      AdminRequestMessages.DATE_RANGE_INVALID,
    ],
  ])("rejects %o with 400", async (query, message) => {
    const response = await list(query);
    expect(response.status).toBe(400);
    expect(response.body.message).toBe(message);
  });

  it("rejects an invalid request id with the DAD message", async () => {
    const response = await request(admin()).get(`${LIST}/abc`).set("Cookie", AUTH_COOKIE);
    expect(response.status).toBe(400);
    expect(response.body.message).toBe(AdminRequestMessages.REQUEST_ID_INVALID);
  });
});

// Opt-in: TEST_PGDATABASE debe nombrar la base de pruebas, con la migración
// database/increment-3/request-status-history.sql aplicada. Cada prueba inserta sus datos dentro
// de una transacción que se revierte al terminar.
describe.skipIf(!process.env.TEST_PGDATABASE)("GET /api/admin/requests against PostgreSQL", () => {
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
  const folios = async (query) => (await get(LIST, query)).body.data.map((row) => row.folio);

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

  async function seedUsers() {
    return {
      admin: await insertUser("ADMIN", "Admin Prueba"),
      logistic: await insertUser("LOGISTICS", "Lucía Logística"),
    };
  }

  // Fecha y horas en hora de Mérida; folios del año 9999 para no chocar con datos reales.
  async function insertRequest({
    clientId,
    status,
    date,
    start = "18:00",
    end = "23:00",
    users,
    folio = null,
  }) {
    sequence += 1;
    const { rows } = await connection.query(
      `INSERT INTO reservations_request
         (folio, client_id, event_date, event_time, event_end_time, guest_count, event_address,
          status, request_date, status_changed_at, logistic_user_id, assigned_by_user_id,
          assigned_at)
       VALUES ($1, $2, $3::date, $4::time, ($3::date + $5::time) AT TIME ZONE 'America/Merida',
         80, 'Hacienda de prueba, Mérida', $6, '2025-01-10T10:00:00-06:00',
         '2025-02-01T09:30:00-06:00', $7::bigint, $8::bigint,
         CASE WHEN $7::bigint IS NULL THEN NULL ELSE '2025-01-11T10:00:00-06:00'::timestamptz END)
       RETURNING id, folio`,
      [
        folio ?? `BD-9999-${String(sequence).padStart(5, "0")}`,
        clientId,
        date,
        start,
        end,
        status,
        users?.logistic ?? null,
        users?.admin ?? null,
      ]
    );
    return { id: Number(rows[0].id), folio: rows[0].folio };
  }

  async function insertDerivedInformation(requestId, adminId, { start, end, location, createdAt }) {
    const { rows } = await connection.query(
      `INSERT INTO derived_information
         (request_id, location, start_datetime, end_datetime, created_by_user_id, created_at)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
      [requestId, location, start, end, adminId, createdAt]
    );
    return Number(rows[0].id);
  }

  async function insertResource(
    type,
    name,
    quantity,
    requestId,
    status = AssignmentStatus.CONFIRMED
  ) {
    const role =
      type === "HUMAN"
        ? (await connection.query("SELECT id, name FROM operative_roles ORDER BY id LIMIT 1"))
            .rows[0]
        : null;
    const { rows } = await connection.query(
      `INSERT INTO resources (name, type, operative_role_id, total_quantity, unit_cost)
       VALUES ($1, $2, $3, $4, $5) RETURNING id`,
      [name, type, role?.id ?? null, type === "HUMAN" ? 1 : 50, type === "HUMAN" ? null : 10]
    );
    await connection.query(
      `INSERT INTO assigned_resources (request_id, resource_id, requested_quantity, quantity,
         sufficiency, usage_start, usage_end, event_start, event_end, status, observation,
         released_at)
       VALUES ($1, $2, $3, $3, $4, '2025-03-05T18:00:00-06:00', '2025-03-05T23:00:00-06:00',
         '2025-03-05T18:00:00-06:00', '2025-03-05T23:00:00-06:00', $5::varchar, $6,
         CASE WHEN $5::varchar = $7 THEN NOW() END)`,
      [
        requestId,
        rows[0].id,
        quantity,
        ResourceSufficiency.SUFFICIENT,
        status,
        type === "MATERIAL" ? "Revisar manteles" : null,
        AssignmentStatus.RELEASED,
      ]
    );
    return { id: Number(rows[0].id), role: role && { id: Number(role.id), name: role.name } };
  }

  async function firstService() {
    return (await connection.query("SELECT id, name FROM services ORDER BY id LIMIT 1")).rows[0];
  }

  describe("Función 2.5 - Seguimiento de eventos", () => {
    it("RF-1.2.5.2 lists only the active requests with the DAD fields", async () => {
      const users = await seedUsers();
      const clientId = await insertClient("Zafiro Activos");
      const service = await firstService();
      const active = [
        "ASSIGNED",
        "COORDINATION_INCOMPLETE",
        "COORDINATION_READY",
        "PROPOSAL_GENERATED",
        "CONFIRMED",
      ];
      const inactive = ["PENDING", "APPROVED", "REJECTED", "FINISHED", "CANCELLED"];
      const created = {};
      for (const [index, status] of [...active, ...inactive].entries()) {
        created[status] = await insertRequest({
          clientId,
          status,
          date: `2025-03-${String(index + 1).padStart(2, "0")}`,
          users,
        });
      }
      await connection.query(
        "INSERT INTO request_services (request_id, service_id) VALUES ($1, $2)",
        [created.CONFIRMED.id, service.id]
      );

      const response = await get(LIST, { active: "true", search: "Zafiro Activos" });

      expect(response.status).toBe(200);
      expect(response.body.data.map((row) => row.status)).toEqual(active);
      expect(response.body.metadata.pagination).toEqual({
        total_records: 5,
        page: 1,
        per_page: 10,
      });
      expect(response.body.data.at(-1)).toEqual({
        request_id: created.CONFIRMED.id,
        folio: created.CONFIRMED.folio,
        client_name: "Zafiro Activos",
        client_email: expect.stringContaining("@example.invalid"),
        requested_date: "2025-01-10T10:00:00-06:00",
        selected_services: [service.name],
        status: "CONFIRMED",
        status_changed_at: "2025-02-01T09:30:00-06:00",
        event_date: "2025-03-05",
        start_time: "18:00",
        end_time: "23:00",
        actual_start_at: null,
        actual_end_at: null,
        event_address: "Hacienda de prueba, Mérida",
        guest_count: 80,
        logistic_user: {
          id: users.logistic,
          full_name: "Lucía Logística",
          email: expect.stringContaining("@example.invalid"),
        },
      });
    });

    it("RF-1.2.5.3 shows the read-only detail with confirmed resources and observations", async () => {
      const users = await seedUsers();
      const clientId = await insertClient("Zafiro Detalle Activo");
      const event = await insertRequest({
        clientId,
        status: "CONFIRMED",
        date: "2025-03-05",
        users,
      });
      const waiter = await insertResource("HUMAN", "Mesero Prueba", 1, event.id);
      const cloth = await insertResource("MATERIAL", "Mantel Prueba", 20, event.id);
      await insertResource(
        "LOGISTIC",
        "Camioneta liberada",
        1,
        event.id,
        AssignmentStatus.RELEASED
      );

      const response = await get(`${LIST}/${event.id}`);

      expect(response.status).toBe(200);
      expect(response.body.data).toMatchObject({
        request_id: event.id,
        folio: event.folio,
        client_name: "Zafiro Detalle Activo",
        client_phone: "9991234567",
        guest_count: 80,
        event_address: "Hacienda de prueba, Mérida",
        event_date_time: "2025-03-05T18:00:00-06:00",
        event_end_time: "2025-03-05T23:00:00-06:00",
        requested_date: "2025-01-10T10:00:00-06:00",
        status: "CONFIRMED",
        status_changed_at: "2025-02-01T09:30:00-06:00",
        selected_services: [],
        logistic_user: { id: users.logistic, full_name: "Lucía Logística" },
        actual_start_at: null,
        actual_end_at: null,
        event_observation: null,
      });
      expect(response.body.data.resource_assignments).toEqual({
        human: [
          {
            id: waiter.id,
            name: "Mesero Prueba",
            type: "HUMAN",
            operative_role_id: waiter.role.id,
            operative_role: waiter.role.name,
            assignment: {
              requested_quantity: 1,
              assigned_quantity: 1,
              available_quantity: 1,
              sufficiency: "Suficiente",
              status: "Confirmada",
              observation: null,
            },
          },
        ],
        material: [
          {
            id: cloth.id,
            name: "Mantel Prueba",
            type: "MATERIAL",
            assignment: {
              requested_quantity: 20,
              assigned_quantity: 20,
              available_quantity: 50,
              sufficiency: "Suficiente",
              status: "Confirmada",
              observation: "Revisar manteles",
            },
          },
        ],
        logistic: [],
      });
    });

    it("NC-02 returns 200 with every resource type assigned through request_id", async () => {
      const users = await seedUsers();
      const clientId = await insertClient("Zafiro Recursos request_id");
      const event = await insertRequest({
        clientId,
        status: "CONFIRMED",
        date: "2025-03-05",
        users,
      });
      await insertResource("HUMAN", "Mesero request_id", 1, event.id);
      await insertResource("MATERIAL", "Mantel request_id", 4, event.id);
      await insertResource("LOGISTIC", "Camioneta request_id", 1, event.id);

      const response = await get(`${LIST}/${event.id}`);

      expect(response.status).toBe(200);
      const { human, material, logistic } = response.body.data.resource_assignments;
      expect([human, material, logistic].map((items) => items.map((item) => item.name))).toEqual([
        ["Mesero request_id"],
        ["Mantel request_id"],
        ["Camioneta request_id"],
      ]);
    });

    it("NC-03 hides released assignments and ignores them for availability", async () => {
      const users = await seedUsers();
      const clientId = await insertClient("Zafiro Liberada");
      const event = await insertRequest({
        clientId,
        status: "CONFIRMED",
        date: "2025-03-05",
        users,
      });
      const other = await insertRequest({
        clientId,
        status: "CONFIRMED",
        date: "2025-03-05",
        users,
      });
      const cloth = await insertResource("MATERIAL", "Mantel compartido", 10, event.id);
      await insertResource("LOGISTIC", "Camioneta propia", 1, event.id, AssignmentStatus.RELEASED);
      // La otra solicitud liberó 40 de los 50 manteles en el mismo horario.
      await connection.query(
        `INSERT INTO assigned_resources (request_id, resource_id, requested_quantity, quantity,
           sufficiency, usage_start, usage_end, event_start, event_end, status, released_at)
         SELECT $1, resource_id, 40, 40, sufficiency, usage_start, usage_end, event_start,
           event_end, $3, NOW()
         FROM assigned_resources WHERE request_id = $2 AND resource_id = $4`,
        [other.id, event.id, AssignmentStatus.RELEASED, cloth.id]
      );

      const { resource_assignments: assignments } = (await get(`${LIST}/${event.id}`)).body.data;

      expect(assignments.logistic).toEqual([]);
      expect(assignments.material).toEqual([
        expect.objectContaining({
          id: cloth.id,
          assignment: expect.objectContaining({ assigned_quantity: 10, available_quantity: 50 }),
        }),
      ]);
    });

    it("RF-1.2.5.3 responds 404 with the DAD message for an unknown request", async () => {
      const response = await get(`${LIST}/999999999`);
      expect(response.status).toBe(404);
      expect(response.body.message).toBe(AdminRequestMessages.REQUEST_NOT_FOUND);
    });

    it("RF-1.2.5.4 records the date of each status change and its history", async () => {
      const users = await seedUsers();
      const clientId = await insertClient("Zafiro Historial");
      const event = await insertRequest({
        clientId,
        status: "ASSIGNED",
        date: "2025-03-05",
        users,
      });

      await connection.query("UPDATE reservations_request SET guest_count = 90 WHERE id = $1", [
        event.id,
      ]);
      expect((await get(`${LIST}/${event.id}`)).body.data.status_changed_at).toBe(
        "2025-02-01T09:30:00-06:00"
      );

      await connection.query("SELECT set_config('app.current_user_id', $1, true)", [
        String(users.admin),
      ]);
      await connection.query(
        "UPDATE reservations_request SET status = 'COORDINATION_READY' WHERE id = $1",
        [event.id]
      );
      const { rows } = await connection.query(
        `SELECT previous_status, new_status, changed_by_user_id, changed_at = now() AS is_now
         FROM request_status_history WHERE request_id = $1 ORDER BY id`,
        [event.id]
      );
      const changedAt = (
        await connection.query(
          "SELECT status_changed_at = now() AS is_now FROM reservations_request WHERE id = $1",
          [event.id]
        )
      ).rows[0];

      expect(changedAt.is_now).toBe(true);
      expect(rows).toEqual([
        { previous_status: null, new_status: "ASSIGNED", changed_by_user_id: null, is_now: false },
        {
          previous_status: "ASSIGNED",
          new_status: "COORDINATION_READY",
          changed_by_user_id: String(users.admin),
          is_now: true,
        },
      ]);
    });

    it("RF-1.2.5.6 orders by current start date and time, then by folio", async () => {
      const users = await seedUsers();
      const clientId = await insertClient("Zafiro Orden");
      const late = await insertRequest({
        clientId,
        status: "CONFIRMED",
        date: "2025-03-20",
        users,
        folio: "BD-9999-90001",
      });
      const tieB = await insertRequest({
        clientId,
        status: "ASSIGNED",
        date: "2025-03-10",
        users,
        folio: "BD-9999-90003",
      });
      const tieA = await insertRequest({
        clientId,
        status: "ASSIGNED",
        date: "2025-03-10",
        users,
        folio: "BD-9999-90002",
      });
      // El acuerdo vigente adelanta este evento al 1 de marzo.
      const moved = await insertRequest({
        clientId,
        status: "CONFIRMED",
        date: "2025-03-25",
        users,
        folio: "BD-9999-90004",
      });
      await insertDerivedInformation(moved.id, users.admin, {
        start: "2025-03-01T12:00:00-06:00",
        end: "2025-03-01T16:00:00-06:00",
        location: "Jardín acordado",
        createdAt: "2025-02-15T10:00:00-06:00",
      });

      expect(await folios({ active: "true", search: "Zafiro Orden" })).toEqual([
        moved.folio,
        tieA.folio,
        tieB.folio,
        late.folio,
      ]);
    });

    it("RF-1.2.5.7 searches by folio or client name and filters by status and responsible", async () => {
      const users = await seedUsers();
      const otherLogistic = await insertUser("LOGISTICS", "Otro Logística");
      const ana = await insertClient("Zafiro Ana Seguimiento");
      const beto = await insertClient("Zafiro Beto Seguimiento");
      const anaAssigned = await insertRequest({
        clientId: ana,
        status: "ASSIGNED",
        date: "2025-03-01",
        users,
      });
      const anaConfirmed = await insertRequest({
        clientId: ana,
        status: "CONFIRMED",
        date: "2025-03-02",
        users: { ...users, logistic: otherLogistic },
      });
      const beto1 = await insertRequest({
        clientId: beto,
        status: "CONFIRMED",
        date: "2025-03-03",
        users,
      });

      expect(await folios({ active: "true", search: "zafiro ana seg" })).toEqual([
        anaAssigned.folio,
        anaConfirmed.folio,
      ]);
      expect(await folios({ active: "true", search: beto1.folio })).toEqual([beto1.folio]);
      expect(await folios({ active: "true", search: "Seguimiento", status: "CONFIRMED" })).toEqual([
        anaConfirmed.folio,
        beto1.folio,
      ]);
      expect(
        await folios({
          active: "true",
          search: "Seguimiento",
          status: "CONFIRMED",
          logistic_user_id: String(otherLogistic),
        })
      ).toEqual([anaConfirmed.folio]);
    });

    it("RF-1.2.5.8 returns 200 with empty data and zero total when nothing matches", async () => {
      const response = await get(LIST, { active: "true", search: "Zafiro Inexistente 2.5" });

      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        data: [],
        metadata: { pagination: { total_records: 0, page: 1, per_page: 10 } },
      });
    });
  });

  describe("Función 2.11 - Consulta de eventos finalizados", () => {
    it("RF-1.2.11.1 lists finished events with status FINALIZED", async () => {
      const users = await seedUsers();
      const clientId = await insertClient("Zafiro Finalizado");
      const finished = await insertRequest({
        clientId,
        status: "FINISHED",
        date: "2025-03-01",
        users,
      });
      await insertRequest({ clientId, status: "CONFIRMED", date: "2025-03-02", users });

      const response = await get(LIST, { status: "FINALIZED", search: "Zafiro Finalizado" });

      expect(response.status).toBe(200);
      expect(response.body.data).toHaveLength(1);
      expect(response.body.data[0]).toMatchObject({
        request_id: finished.id,
        folio: finished.folio,
        client_name: "Zafiro Finalizado",
        event_date: "2025-03-01",
        status: "FINALIZED",
      });
    });

    it("RF-1.2.11.2 shows the finished event detail with real hours and observations", async () => {
      const users = await seedUsers();
      const clientId = await insertClient("Zafiro Ficha Final");
      const event = await insertRequest({
        clientId,
        status: "FINISHED",
        date: "2025-03-05",
        users,
      });
      await insertResource("MATERIAL", "Mesa Final", 5, event.id);

      const { data } = (await get(`${LIST}/${event.id}`)).body;

      expect(data).toMatchObject({
        status: "FINALIZED",
        client_name: "Zafiro Ficha Final",
        event_date_time: "2025-03-05T18:00:00-06:00",
        event_address: "Hacienda de prueba, Mérida",
        logistic_user: { id: users.logistic },
        actual_start_at: null,
        actual_end_at: null,
        event_observation: null,
      });
      expect(data.resource_assignments.material[0].assignment.status).toBe("Confirmada");
    });

    it("RF-1.2.11.3 combines search and the event date range over the current date", async () => {
      const users = await seedUsers();
      const ana = await insertClient("Zafiro Ana Filtro");
      const beto = await insertClient("Zafiro Beto Filtro");
      const anaMarch = await insertRequest({
        clientId: ana,
        status: "FINISHED",
        date: "2025-03-10",
        users,
      });
      await insertRequest({ clientId: ana, status: "FINISHED", date: "2025-06-10", users });
      const betoMarch = await insertRequest({
        clientId: beto,
        status: "FINISHED",
        date: "2025-03-15",
        users,
      });
      // Registrada en marzo, pero el acuerdo vigente la movió a abril.
      const anaMoved = await insertRequest({
        clientId: ana,
        status: "FINISHED",
        date: "2025-03-20",
        users,
      });
      await insertDerivedInformation(anaMoved.id, users.admin, {
        start: "2025-04-02T18:00:00-06:00",
        end: "2025-04-02T23:00:00-06:00",
        location: "Otro salón",
        createdAt: "2025-02-15T10:00:00-06:00",
      });
      const range = { event_date_from: "2025-03-01", event_date_to: "2025-03-31" };

      expect(await folios({ status: "FINALIZED", search: "Zafiro", ...range })).toEqual([
        anaMarch.folio,
        betoMarch.folio,
      ]);
      expect(await folios({ status: "FINALIZED", search: "Ana Filtro", ...range })).toEqual([
        anaMarch.folio,
      ]);
      expect(await folios({ status: "FINALIZED", search: betoMarch.folio })).toEqual([
        betoMarch.folio,
      ]);
    });

    it("RF-1.2.11.4 returns 200 with empty data and zero total when filters match nothing", async () => {
      const users = await seedUsers();
      const clientId = await insertClient("Zafiro Sin Resultados");
      await insertRequest({ clientId, status: "FINISHED", date: "2025-03-01", users });

      const response = await get(LIST, {
        status: "FINALIZED",
        search: "Zafiro Sin Resultados",
        event_date_from: "2025-04-01",
      });

      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        data: [],
        metadata: { pagination: { total_records: 0, page: 1, per_page: 10 } },
      });
    });
  });

  describe("Reglas comunes del DAD", () => {
    it("uses the latest derived_information row (created_at, then id) as current data", async () => {
      const users = await seedUsers();
      const clientId = await insertClient("Zafiro Vigente");
      const event = await insertRequest({
        clientId,
        status: "CONFIRMED",
        date: "2025-03-05",
        users,
      });
      const older = {
        start: "2025-03-06T10:00:00-06:00",
        end: "2025-03-06T12:00:00-06:00",
        location: "Acuerdo viejo",
        createdAt: "2025-02-10T10:00:00-06:00",
      };
      const latest = {
        ...older,
        location: "Acuerdo empate menor id",
        createdAt: "2025-02-20T10:00:00-06:00",
      };
      await insertDerivedInformation(event.id, users.admin, older);
      await insertDerivedInformation(event.id, users.admin, latest);
      await insertDerivedInformation(event.id, users.admin, {
        ...latest,
        start: "2025-03-07T19:00:00-06:00",
        end: "2025-03-08T01:30:00-06:00",
        location: "Acuerdo vigente",
      });

      const [row] = (await get(LIST, { search: "Zafiro Vigente" })).body.data;
      const { data } = (await get(`${LIST}/${event.id}`)).body;

      expect(row).toMatchObject({
        event_date: "2025-03-07",
        start_time: "19:00",
        end_time: "01:30",
        event_address: "Acuerdo vigente",
        guest_count: 80,
      });
      expect(data).toMatchObject({
        event_date_time: "2025-03-07T19:00:00-06:00",
        event_end_time: "2025-03-08T01:30:00-06:00",
        event_address: "Acuerdo vigente",
      });
    });

    it("paginates after ordering and reports the total records", async () => {
      const users = await seedUsers();
      const clientId = await insertClient("Zafiro Paginado");
      const created = [];
      for (const day of ["01", "02", "03"]) {
        created.push(
          await insertRequest({ clientId, status: "ASSIGNED", date: `2025-03-${day}`, users })
        );
      }

      const response = await get(LIST, { search: "Zafiro Paginado", page: "2", per_page: "2" });

      expect(response.body.data.map((row) => row.folio)).toEqual([created[2].folio]);
      expect(response.body.metadata.pagination).toEqual({ total_records: 3, page: 2, per_page: 2 });
    });

    it("keeps the Función 2.4 uses: approved requests without responsible", async () => {
      const clientId = await insertClient("Zafiro Aprobada");
      const approved = await insertRequest({ clientId, status: "APPROVED", date: "2025-03-01" });

      const response = await get(LIST, { status: "APPROVED", search: "Zafiro Aprobada" });

      expect(response.body.data).toEqual([
        expect.objectContaining({
          request_id: approved.id,
          status: "APPROVED",
          logistic_user: null,
        }),
      ]);
    });
  });
});
