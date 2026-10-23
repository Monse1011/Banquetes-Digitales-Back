const request = require("supertest");
const { createApp } = require("../app");
const {
  InMemoryReservationRequestRepository,
} = require("../../infrastructure/repositories/reservation-request/in-memory-reservation-request-repository");
const {
  InMemoryResourceRepository,
} = require("../../infrastructure/repositories/resource/in-memory-resource-repository");
const {
  InMemoryOperativeRoleRepository,
} = require("../../infrastructure/repositories/operative-role/in-memory-operative-role-repository");
const {
  createResourceUseCases,
} = require("../../application/use-cases/resource/create-resource-use-cases");
const {
  ReservationRequest,
} = require("../../domain/entities/reservation-request/reservation-request");
const UserRole = require("../../domain/enums/auth/user-role");

const AUTH_COOKIE = "auth_token=valid-token";
const notUsed = (_req, res) => res.status(501).end();

function buildApp(role, userId = 10, reservationRequestRepository = null) {
  const resourceRepository = new InMemoryResourceRepository([]);
  const operativeRoleRepository = new InMemoryOperativeRoleRepository([]);
  const repo = reservationRequestRepository || new InMemoryReservationRequestRepository();

  return createApp({
    authController: { 
      session: (_req, res) => res.sendStatus(501), 
      logout: (_req, res) => res.sendStatus(501), 
      login: notUsed, 
      changePassword: notUsed, 
      firstAccess: notUsed 
    },
    passwordResetController: { requestReset: notUsed, resetPassword: notUsed },
    tokenService: { verifyToken: () => ({ id_user: userId, role }) },
    reservationRequestRepository: repo,
    ...createResourceUseCases(resourceRepository, operativeRoleRepository),
  });
}

function makeReservation({
  id,
  folio,
  logisticUserId = 10,
  status = "Asignada",
  eventDateTime = new Date("2026-12-24T18:00:00Z"),
  clientName = "Andrea Morales",
  clientEmail = "andrea@gmail.com",
  clientPhone = "9991234567",
  eventAddress = "Salón Los Pinos Mérida",
}) {
  const endDateTime = new Date(eventDateTime.getTime() + 4 * 60 * 60 * 1000);
  const req = new ReservationRequest(
    id,
    folio,
    1,
    1,
    eventDateTime,
    endDateTime,
    150,
    eventAddress,
    status,
    new Date(),
    [1],
    logisticUserId,
    null,
    null,
    clientName,
    clientEmail,
    clientPhone
  );
  req.services = [
    {
      service_id: 1,
      service_name: "Banquete",
      required_resources: [
        { type: "human", resource_or_operative_role: "Chef", quantity: 2 },
        { type: "material", resource_or_operative_role: "Vajilla completa", quantity: 150 },
      ],
    },
  ];
  return req;
}

describe("Logistics reservation request routes (Función 3.1)", () => {
  describe("GET /api/logistics/requests", () => {
    it("lists assigned active requests for the logged in logistics user (RF-2.3.1.1)", async () => {
      const repo = new InMemoryReservationRequestRepository();
      const req1 = makeReservation({
        id: 1,
        folio: "EVT-001",
        logisticUserId: 10,
        status: "Asignada",
      });
      const reqOther = makeReservation({
        id: 2,
        folio: "EVT-002",
        logisticUserId: 99,
        status: "Asignada",
      });
      await repo.create(req1);
      await repo.create(reqOther);

      const app = buildApp(UserRole.LOGISTICS, 10, repo);

      const response = await request(app).get("/api/logistics/requests").set("Cookie", AUTH_COOKIE);

      expect(response.status).toBe(200);
      expect(response.body.data.requests).toHaveLength(1);
      expect(response.body.data.requests[0].folio).toBe("EVT-001");
      expect(response.body.data.requests[0].client_name).toBe("Andrea Morales");
      expect(response.body.metadata.pagination.total_records).toBe(1);
    });

    it("returns message 'No tiene solicitudes de eventos asignadas.' when empty (NC 15, RF-2.3.1.2)", async () => {
      const repo = new InMemoryReservationRequestRepository();
      const app = buildApp(UserRole.LOGISTICS, 10, repo);

      const response = await request(app).get("/api/logistics/requests").set("Cookie", AUTH_COOKIE);

      expect(response.status).toBe(200);
      expect(response.body.message).toBe("No tiene solicitudes de eventos asignadas.");
      expect(response.body.data.requests).toEqual([]);
      expect(response.body.metadata.pagination.total_records).toBe(0);
    });

    it("orders requests ascending by event date and start time with folio tie breaker (NC 17, RF-2.3.1.5)", async () => {
      const repo = new InMemoryReservationRequestRepository();
      const reqLater = makeReservation({
        id: 1,
        folio: "EVT-003",
        logisticUserId: 10,
        eventDateTime: new Date("2026-12-25T18:00:00Z"),
      });
      const reqTieB = makeReservation({
        id: 2,
        folio: "EVT-002",
        logisticUserId: 10,
        eventDateTime: new Date("2026-12-24T18:00:00Z"),
      });
      const reqTieA = makeReservation({
        id: 3,
        folio: "EVT-001",
        logisticUserId: 10,
        eventDateTime: new Date("2026-12-24T18:00:00Z"),
      });

      await repo.create(reqLater);
      await repo.create(reqTieB);
      await repo.create(reqTieA);

      const app = buildApp(UserRole.LOGISTICS, 10, repo);

      const response = await request(app).get("/api/logistics/requests").set("Cookie", AUTH_COOKIE);

      expect(response.status).toBe(200);
      const folios = response.body.data.requests.map((r) => r.folio);
      expect(folios).toEqual(["EVT-001", "EVT-002", "EVT-003"]);
    });

    it("filters by status and rejects invalid status with 400", async () => {
      const repo = new InMemoryReservationRequestRepository();
      const req = makeReservation({
        id: 1,
        folio: "EVT-001",
        logisticUserId: 10,
        status: "Confirmado",
      });
      await repo.create(req);

      const app = buildApp(UserRole.LOGISTICS, 10, repo);

      const resFiltered = await request(app)
        .get("/api/logistics/requests?status=Confirmado")
        .set("Cookie", AUTH_COOKIE);
      expect(resFiltered.status).toBe(200);
      expect(resFiltered.body.data.requests).toHaveLength(1);

      const resInvalid = await request(app)
        .get("/api/logistics/requests?status=Invalido")
        .set("Cookie", AUTH_COOKIE);
      expect(resInvalid.status).toBe(400);
    });
  });

  describe("GET /api/logistics/requests/history", () => {
    it("lists completed and cancelled requests for the logistics user (RF-2.3.1.1)", async () => {
      const repo = new InMemoryReservationRequestRepository();
      const reqHist = makeReservation({
        id: 1,
        folio: "EVT-H01",
        logisticUserId: 10,
        status: "Finalizado",
      });
      const reqActive = makeReservation({
        id: 2,
        folio: "EVT-A01",
        logisticUserId: 10,
        status: "Asignada",
      });
      await repo.create(reqHist);
      await repo.create(reqActive);

      const app = buildApp(UserRole.LOGISTICS, 10, repo);

      const response = await request(app)
        .get("/api/logistics/requests/history")
        .set("Cookie", AUTH_COOKIE);

      expect(response.status).toBe(200);
      expect(response.body.data.requests).toHaveLength(1);
      expect(response.body.data.requests[0].status).toBe("Finalizado");
    });
  });

  describe("GET /api/logistics/requests/:id", () => {
    it("returns full detail with client and services (NC 13, RF-2.3.1.3)", async () => {
      const repo = new InMemoryReservationRequestRepository();
      const req = makeReservation({
        id: 1,
        folio: "EVT-001",
        logisticUserId: 10,
        clientName: "Andrea Morales",
        clientEmail: "andrea@gmail.com",
        clientPhone: "9991234567",
      });
      await repo.create(req);

      const app = buildApp(UserRole.LOGISTICS, 10, repo);

      const response = await request(app)
        .get("/api/logistics/requests/1")
        .set("Cookie", AUTH_COOKIE);

      expect(response.status).toBe(200);
      expect(response.body.data.client).toEqual({
        client_name: "Andrea Morales",
        client_email: "andrea@gmail.com",
        client_phone: "9991234567",
      });
      expect(response.body.data.schedule_type).toBe("propuesto");
      expect(response.body.data.selected_services).toHaveLength(1);
    });

    it("displays 'Sin registrar' for unrecorded optional fields (RF-2.3.1.4)", async () => {
      const repo = new InMemoryReservationRequestRepository();
      const req = makeReservation({
        id: 2,
        folio: "EVT-002",
        logisticUserId: 10,
        clientPhone: null,
        eventAddress: null,
      });
      await repo.create(req);

      const app = buildApp(UserRole.LOGISTICS, 10, repo);

      const response = await request(app)
        .get("/api/logistics/requests/2")
        .set("Cookie", AUTH_COOKIE);

      expect(response.status).toBe(200);
      expect(response.body.data.client.client_phone).toBe("Sin registrar");
      expect(response.body.data.event_address).toBe("Sin registrar");
    });

    it("denies access with 403 when request belongs to another responsible user (RF-2.3.1.7)", async () => {
      const repo = new InMemoryReservationRequestRepository();
      const req = makeReservation({
        id: 3,
        folio: "EVT-003",
        logisticUserId: 99,
      });
      await repo.create(req);

      const app = buildApp(UserRole.LOGISTICS, 10, repo);

      const response = await request(app)
        .get("/api/logistics/requests/3")
        .set("Cookie", AUTH_COOKIE);

      expect(response.status).toBe(403);
      expect(response.body.message).toBe("No tiene permisos para acceder a esta solicitud.");
    });

    it("returns 404 when request is not found", async () => {
      const repo = new InMemoryReservationRequestRepository();
      const app = buildApp(UserRole.LOGISTICS, 10, repo);

      const response = await request(app)
        .get("/api/logistics/requests/999")
        .set("Cookie", AUTH_COOKIE);

      expect(response.status).toBe(404);
    });

    it("returns 400 for invalid id parameter", async () => {
      const repo = new InMemoryReservationRequestRepository();
      const app = buildApp(UserRole.LOGISTICS, 10, repo);

      const response = await request(app)
        .get("/api/logistics/requests/invalid-id")
        .set("Cookie", AUTH_COOKIE);

      expect(response.status).toBe(400);
    });
  });

  describe("Security and roles", () => {
    it("requires authentication", async () => {
      const repo = new InMemoryReservationRequestRepository();
      const app = buildApp(UserRole.LOGISTICS, 10, repo);

      const response = await request(app).get("/api/logistics/requests");
      expect(response.status).toBe(401);
    });

    it("denies access to non-logistics users (e.g. admin)", async () => {
      const repo = new InMemoryReservationRequestRepository();
      const app = buildApp(UserRole.ADMIN, 10, repo);

      const response = await request(app).get("/api/logistics/requests").set("Cookie", AUTH_COOKIE);
      expect(response.status).toBe(403);
    });
  });
});
