// Contratos 13, 14 y 15 contra el PostgreSQL desechable (docker-compose.test.yml).
// Cada prueba siembra su grafo dentro de una transacción que se revierte; el repositorio
// recibe la misma conexión, así ve los datos sin commit.
const { Pool } = require("pg");
const request = require("supertest");
const ExcelJS = require("exceljs");
const { createApp } = require("../app");
const {
  PostgresReportRepository,
} = require("../../infrastructure/repositories/report/postgres-report-repository");
const {
  PostgresClientDirectoryRepository,
} = require("../../infrastructure/repositories/client/postgres-client-directory-repository");
const GenerateReportUseCase = require("../../application/use-cases/reports/generate-report-use-case");
const ExportReportUseCase = require("../../application/use-cases/reports/export-report-use-case");
const ListReportClientsUseCase = require("../../application/use-cases/reports/list-report-clients-use-case");
const { writeReportWorkbook } = require("../../infrastructure/services/excel/excel-report-writer");
const { ReportMessages } = require("../../domain/constants/report-messages");
const AuthMessages = require("../constants/auth-messages");
const UserRole = require("../../domain/enums/auth/user-role");

const AUTH_COOKIE = "auth_token=valid-token";
const REPORTS = "/api/admin/reports";
const EXPORT = "/api/admin/reports/export";
const CLIENTS = "/api/admin/clients";

function notUsed(_req, res) {
  res.sendStatus(501);
}

function buildApp(role, connection) {
  const reportRepository = new PostgresReportRepository(connection);
  const generate = new GenerateReportUseCase(reportRepository);

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
    generateReportUseCase: generate,
    exportReportUseCase: new ExportReportUseCase(generate, reportRepository, {
      write: writeReportWorkbook,
    }),
    listReportClientsUseCase: new ListReportClientsUseCase(
      new PostgresClientDirectoryRepository(connection)
    ),
  });
}

async function insert(db, sql, values = []) {
  const { rows } = await db.query(sql, values);

  return rows[0];
}

async function seedReportGraph(db) {
  const ana = await insert(
    db,
    "INSERT INTO clients (full_name, email, phone) VALUES ('Ana López', 'ana@x.co', '9990000001') RETURNING id"
  );
  const luis = await insert(
    db,
    "INSERT INTO clients (full_name, email, phone) VALUES ('Luis Pérez', 'Luis@X.co', '9990000002') RETURNING id"
  );
  const banquetes = await insert(
    db,
    `INSERT INTO services (name, description, price)
     VALUES ('Banquetes', 'Menú completo', 100) RETURNING id`
  );
  const decoracion = await insert(
    db,
    `INSERT INTO services (name, description, price, status)
     VALUES ('Decoración', 'Flores y mantelería', 50, 'INACTIVE') RETURNING id`
  );
  const verano = await insert(
    db,
    `INSERT INTO promotions (name, description, discount_percentage, valid_until)
     VALUES ('Verano', 'Descuento de temporada', 10.00, '2099-12-31') RETURNING id`
  );

  const requestIds = {};
  const requests = [
    [
      "R1",
      ana.id,
      "PENDING",
      "2026-10-03T16:15:00Z",
      "2026-11-14",
      [[banquetes.id, "Banquetes", "Menú completo", 100]],
    ],
    [
      "R2",
      luis.id,
      "CONFIRMED",
      "2026-10-05T16:40:00Z",
      "2026-12-02",
      [
        [banquetes.id, "Banquetes", "Menú completo", 100],
        [decoracion.id, "Decoración", "Flores y mantelería", 50],
      ],
    ],
    [
      "R3",
      ana.id,
      "FINALIZED",
      "2026-11-01T15:00:00Z",
      "2027-01-10",
      [[banquetes.id, "Banquetes", "Menú completo", 100]],
    ],
    [
      "R4",
      luis.id,
      "REJECTED",
      "2025-09-01T12:00:00Z",
      "2025-10-01",
      [[decoracion.id, "Decoración", "Flores y mantelería", 50]],
    ],
  ];

  for (const [key, clientId, status, requestDate, eventDate, services] of requests) {
    const row = await insert(
      db,
      `INSERT INTO reservations_request
         (folio, client_id, event_date, event_time, guest_count, event_address, status, request_date)
       VALUES ($1, $2, $3::date, '18:00', 80, 'Hacienda de prueba', $4, $5) RETURNING id`,
      [`BD-2026-0000${key.slice(1)}`, clientId, eventDate, status, requestDate]
    );
    requestIds[key] = Number(row.id);

    for (const [serviceId, name, description, price] of services) {
      await db.query(
        `INSERT INTO request_services
           (request_id, service_id, service_name_snapshot, service_description_snapshot,
            service_price_snapshot)
         VALUES ($1, $2, $3, $4, $5)`,
        [requestIds[key], serviceId, name, description, price]
      );
    }
  }

  // R2 tiene acuerdo vigente: la fecha efectiva del evento es la de start_datetime en
  // Mérida (2026-12-04 18:00 local), no la de la solicitud (2026-12-02).
  await insert(
    db,
    `INSERT INTO derived_information (request_id, location, start_datetime, end_datetime)
     VALUES ($1, 'Salón vigente', '2026-12-05T00:00:00Z', '2026-12-05T05:00:00Z') RETURNING id`,
    [requestIds.R2]
  );
  const derivedR3 = await insert(
    db,
    `INSERT INTO derived_information (request_id, location, start_datetime, end_datetime)
     VALUES ($1, 'Salón R3', '2027-01-10T06:00:00Z', '2027-01-10T17:00:00Z') RETURNING id`,
    [requestIds.R3]
  );

  // R3: propuesta ACCEPTED con la promoción Verano aplicada (copia congelada).
  await insert(
    db,
    `INSERT INTO proposals
       (request_id, derived_information_id, proposal_code, file_name, status, subtotal,
        total_amount, accepted_at, promotion_id, promotion_name_snapshot,
        promotion_description_snapshot, promotion_discount_snapshot)
     VALUES ($1, $2, 'PROP-2027-0001', 'p.pdf', 'ACCEPTED', 90, 90, now(), $3, 'Verano',
        'Descuento de temporada', 10.00) RETURNING id`,
    [requestIds.R3, derivedR3.id, verano.id]
  );

  return { ana, luis, banquetes, decoracion, verano, requestIds };
}

describe.skipIf(!process.env.TEST_PGDATABASE)(
  "Reportes y clientes contra PostgreSQL (contratos 13 a 15)",
  () => {
    let pool;
    let connection;
    let app;
    let graph;

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
      graph = await seedReportGraph(connection);
      app = buildApp(UserRole.ADMIN, connection);
    });

    afterEach(async () => {
      await connection.query("ROLLBACK");
      connection.release();
    });

    const get = (url, query = {}) => request(app).get(url).query(query).set("Cookie", AUTH_COOKIE);
    const report = async (query) => {
      const response = await get(REPORTS, query);
      expect(response.status).toBe(200);

      return response.body.data.report;
    };

    describe("acceso (RF-1.2.15.1 y RF-3.4.1.1.1)", () => {
      it.each([REPORTS, EXPORT, CLIENTS])("401 sin sesión en %s", async (url) => {
        const response = await request(app).get(url);

        expect(response.status).toBe(401);
        expect(response.body.message).toBe(AuthMessages.TOKEN_MISSING);
      });

      it.each([REPORTS, EXPORT, CLIENTS])("403 con rol LOGISTICS en %s", async (url) => {
        const response = await request(buildApp(UserRole.LOGISTICS, connection))
          .get(url)
          .set("Cookie", AUTH_COOKIE);

        expect(response.status).toBe(403);
        expect(response.body.message).toBe(AuthMessages.FORBIDDEN);
      });
    });

    describe("validaciones del query (§7)", () => {
      it.each([
        [{}, ReportMessages.INVALID_TYPE],
        [{ type: "FINANCES" }, ReportMessages.INVALID_TYPE],
        [{ type: "REQUESTS", period_type: "DAY" }, ReportMessages.MISSING_DATE],
        [{ type: "REQUESTS", period_type: "MONTH" }, ReportMessages.MISSING_MONTH],
        [
          { type: "REQUESTS", period_type: "RANGE", from: "2026-10-01" },
          ReportMessages.MISSING_RANGE,
        ],
        [
          { type: "REQUESTS", period_type: "RANGE", from: "2026-10-10", to: "2026-10-01" },
          ReportMessages.INVALID_RANGE,
        ],
        [{ type: "REQUESTS", period_type: "WEEK" }, ReportMessages.INVALID_QUERY],
        [{ type: "EVENTS", service_id: "abc" }, ReportMessages.INVALID_QUERY],
      ])("400 %s → %s", async (query, message) => {
        const response = await get(REPORTS, query);

        expect(response.status).toBe(400);
        expect(response.body.message).toBe(message);
      });
    });

    it("REQUESTS: universo completo, orden por request_date desc y fecha vigente del evento", async () => {
      const reportData = await report({ type: "REQUESTS" });

      expect(reportData.title).toBe("Solicitudes de reservación recibidas");
      expect(reportData.summary).toEqual({ total: 4 });
      expect(reportData.table.map((row) => row.folio)).toEqual([
        "BD-2026-00003",
        "BD-2026-00002",
        "BD-2026-00001",
        "BD-2026-00004",
      ]);
      expect(reportData.table[0]).toEqual({
        folio: "BD-2026-00003",
        client_name: "Ana López",
        request_date: "2026-11-01T09:00:00-06:00",
        event_date: "2027-01-10",
        status: "FINALIZED",
      });
      // NONE → meses desde el registro más antiguo hasta el más reciente (AD-08).
      expect(reportData.chart.type).toBe("bar");
      expect(reportData.chart.x_label).toBe("Mes");
      expect(reportData.chart.buckets[0]).toEqual({ label: "2025-09", count: 1 });
      expect(reportData.chart.buckets.at(-1)).toEqual({ label: "2026-11", count: 1 });
      expect(reportData.chart.note).toBeNull();
    });

    it("REQUESTS con MONTH: días con ceros y nota de truncado (ejemplo del contrato 13)", async () => {
      const reportData = await report({ type: "REQUESTS", period_type: "MONTH", month: "2026-10" });

      expect(reportData.table.map((row) => row.folio)).toEqual(["BD-2026-00002", "BD-2026-00001"]);
      expect(reportData.chart.buckets).toEqual([
        { label: "2026-10-01", count: 0 },
        { label: "2026-10-02", count: 0 },
        { label: "2026-10-03", count: 1 },
        { label: "2026-10-04", count: 0 },
        { label: "2026-10-05", count: 1 },
      ]);
      expect(reportData.chart.note).toBe("Se muestran 5 de 31 intervalos.");
    });

    it("REQUESTS con DAY: un único día no lleva gráfica (RF-1.2.15.5.2)", async () => {
      const reportData = await report({ type: "REQUESTS", period_type: "DAY", date: "2026-10-03" });

      expect(reportData.table).toHaveLength(1);
      expect(reportData.chart).toBeNull();
    });

    it("EVENTS: solo FINALIZED, nombre contratado por copia y promoción de la propuesta ACCEPTED", async () => {
      const reportData = await report({ type: "EVENTS" });

      expect(reportData.summary).toEqual({ total: 1 });
      expect(reportData.table[0]).toEqual({
        folio: "BD-2026-00003",
        client_name: "Ana López",
        event_date: "2027-01-10",
        services: ["Banquetes"],
        promotion: { name: "Verano", status: "ACTIVE" },
      });
      expect(reportData.chart.type).toBe("line");
      expect(reportData.chart.y_label).toBe("Eventos");
    });

    it("EVENTS usa la fecha vigente del evento para el periodo (derived_information)", async () => {
      const december = await report({
        type: "EVENTS",
        period_type: "MONTH",
        month: "2026-12",
      });
      expect(december.summary.total).toBe(0);

      // R2 no es FINALIZED, pero su fecha vigente (2026-12-04) sí cae en diciembre:
      // se comprueba con SERVICES, cuyo universo también usa la fecha vigente.
      const services = await report({ type: "SERVICES", period_type: "MONTH", month: "2026-12" });
      expect(services.table.map((row) => row.name)).toEqual([
        "Banquetes",
        "Decoración (No vigente)",
      ]);
    });

    it("SERVICES: universo CONFIRMED/FINALIZED con INACTIVE incluido, orden y porcentajes", async () => {
      const reportData = await report({ type: "SERVICES" });

      expect(reportData.summary).toEqual({ total: 3 });
      expect(reportData.table).toEqual([
        {
          service_id: graph.banquetes.id,
          name: "Banquetes",
          status: "ACTIVE",
          times_contracted: 2,
          percentage: 66.67,
        },
        {
          service_id: graph.decoracion.id,
          name: "Decoración (No vigente)",
          status: "INACTIVE",
          times_contracted: 1,
          percentage: 33.33,
        },
      ]);
      expect(reportData.chart.type).toBe("pie");
      expect(reportData.chart.buckets).toEqual([
        { label: "Banquetes", count: 2 },
        { label: "Decoración (No vigente)", count: 1 },
      ]);
    });

    it("PROMOTIONS: propuestas ACCEPTED de CONFIRMED/FINALIZED; un solo uso deja la gráfica en null", async () => {
      const reportData = await report({ type: "PROMOTIONS" });

      expect(reportData.summary).toEqual({ total: 1 });
      expect(reportData.table[0]).toEqual({
        promotion_id: graph.verano.id,
        name: "Verano",
        status: "ACTIVE",
        times_used: 1,
        percentage: 100,
      });
      expect(reportData.chart).toBeNull();
    });

    it("combina filtros con AND y sin distinguir mayúsculas el correo (RF-1.2.15.3.15)", async () => {
      const combined = await report({
        type: "REQUESTS",
        period_type: "MONTH",
        month: "2026-10",
        client_email: " ANA@X.CO ",
      });
      expect(combined.table.map((row) => row.folio)).toEqual(["BD-2026-00001"]);

      const byService = await report({ type: "SERVICES", service_id: String(graph.decoracion.id) });
      expect(byService.summary).toEqual({ total: 1 });
      expect(byService.chart).toBeNull();

      const ignored = await report({ type: "REQUESTS", service_id: String(graph.decoracion.id) });
      expect(ignored.summary.total).toBe(4);
      expect(ignored.filters).not.toHaveProperty("service_id");
    });

    it("EVENTS filtra por promotion_id de la propuesta ACCEPTED", async () => {
      const other = await report({ type: "EVENTS", promotion_id: "999999" });
      expect(other.table).toEqual([]);

      const same = await report({ type: "EVENTS", promotion_id: String(graph.verano.id) });
      expect(same.summary.total).toBe(1);
    });

    describe("exportar (contrato 14)", () => {
      it("404 sin archivo cuando no hay resultados (RF-1.2.15.7/15.8)", async () => {
        const response = await get(EXPORT, { type: "PROMOTIONS", client_email: "luis@x.co" });

        expect(response.status).toBe(404);
        expect(response.body.message).toBe(ReportMessages.EXPORT_EMPTY);
      });

      it("200 con xlsx, Content-Type y Content-Disposition reporte-{tipo}-{fecha}.xlsx", async () => {
        const response = await request(app)
          .get(EXPORT)
          .query({ type: "REQUESTS", period_type: "DAY", date: "2026-10-03" })
          .set("Cookie", AUTH_COOKIE)
          .buffer()
          .parse((res, callback) => {
            const chunks = [];
            res.on("data", (chunk) => chunks.push(chunk));
            res.on("end", () => callback(null, Buffer.concat(chunks)));
          });

        expect(response.status).toBe(200);
        expect(response.headers["content-type"]).toContain(
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        );
        expect(response.headers["content-disposition"]).toMatch(
          /^attachment; filename="reporte-solicitudes-\d{4}-\d{2}-\d{2}\.xlsx"$/
        );

        const workbook = new ExcelJS.Workbook();
        await workbook.xlsx.load(response.body);
        const sheet = workbook.getWorksheet("Reporte");
        expect(sheet.getCell("A1").value).toBe("Solicitudes de reservación recibidas");
        expect(sheet.getCell("A3").value).toBe("Periodo: Día 2026-10-03");
        expect(sheet.getCell("A6").value).toBe("Total: 1 solicitudes");
      });

      it("el query inválido se rechaza igual que en el contrato 13", async () => {
        const response = await get(EXPORT, { type: "NOPE" });

        expect(response.status).toBe(400);
        expect(response.body.message).toBe(ReportMessages.INVALID_TYPE);
      });
    });

    describe("GET /api/admin/clients (contrato 15)", () => {
      it("solo clientes con solicitudes, orden name,email y shape {email,name}", async () => {
        const response = await get(CLIENTS);

        expect(response.status).toBe(200);
        expect(response.body.data.clients).toEqual([
          { email: "ana@x.co", name: "Ana López" },
          { email: "Luis@X.co", name: "Luis Pérez" },
        ]);
      });

      it("excluye clientes sin solicitudes", async () => {
        await insert(
          connection,
          "INSERT INTO clients (full_name, email, phone) VALUES ('Sin Solicitudes', 'sin@x.co', '9990000009')"
        );

        const response = await get(CLIENTS);

        expect(response.body.data.clients.map((client) => client.email)).toEqual([
          "ana@x.co",
          "Luis@X.co",
        ]);
      });
    });
  }
);
