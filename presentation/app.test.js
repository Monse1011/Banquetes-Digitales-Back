const request = require("supertest");
const { createApp } = require("./app");
const {
  InMemoryClientRepository,
} = require("../infrastructure/repositories/client/in-memory-client-repository");
const {
  InMemoryServiceRepository,
} = require("../infrastructure/repositories/service/in-memory-service-repository");
const {
  InMemoryReservationRequestRepository,
} = require("../infrastructure/repositories/reservation-request/in-memory-reservation-request-repository");
const {
  InMemoryFolioGenerator,
} = require("../infrastructure/services/reservation-request/in-memory-folio-generator");
const {
  UpsertClientByEmailUseCase,
} = require("../application/use-cases/client/upsert-client-by-email-use-case");
const {
  CreateReservationRequestUseCase,
} = require("../application/use-cases/reservation-request/create-reservation-request-use-case");
const {
  ApproveReservationRequestUseCase,
} = require("../application/use-cases/reservation-request/approve-reservation-request-use-case");
const {
  GetReservationRequestUseCase,
} = require("../application/use-cases/reservation-request/get-reservation-request-use-case");
const {
  GetReservationRequestsUseCase,
} = require("../application/use-cases/reservation-request/get-reservation-requests-use-case");
const { Service } = require("../domain/entities/service/service");

describe("App", () => {
  let app;

  beforeEach(() => {
    const clientRepository = new InMemoryClientRepository();
    const serviceRepository = new InMemoryServiceRepository([
      new Service(1, "Catering", "Servicio de catering", "activo"),
      new Service(2, "Decoración", "Servicio de decoración", "activo"),
    ]);
    const reservationRequestRepository = new InMemoryReservationRequestRepository();
    const folioGenerator = new InMemoryFolioGenerator();

    const upsertClientByEmailUseCase = new UpsertClientByEmailUseCase(clientRepository);
    const createReservationRequestUseCase = new CreateReservationRequestUseCase(
      upsertClientByEmailUseCase,
      reservationRequestRepository,
      folioGenerator
    );
    const approveReservationRequestUseCase = new ApproveReservationRequestUseCase(
      reservationRequestRepository
    );
    const getReservationRequestUseCase = new GetReservationRequestUseCase(
      reservationRequestRepository,
      clientRepository,
      serviceRepository
    );
    const getReservationRequestsUseCase = new GetReservationRequestsUseCase(
      reservationRequestRepository,
      clientRepository,
      serviceRepository
    );

    app = createApp({
      authController: {
        login: (_req, res) => res.status(200).json({}),
        changePassword: (_req, res) => res.status(200).json({}),
        firstAccess: (_req, res) => res.status(200).json({ firstAccess: true }),
      },
      passwordResetController: {
        requestReset: (_req, res) => res.status(200).json({}),
        resetPassword: (_req, res) => res.status(200).json({}),
      },
      tokenService: {
        verifyToken: () => ({ id_user: 1, role: "admin" }),
      },
      clientRepository,
      serviceRepository,
      reservationRequestRepository,
      folioGenerator,
      upsertClientByEmailUseCase,
      createReservationRequestUseCase,
      approveReservationRequestUseCase,
      getReservationRequestUseCase,
      getReservationRequestsUseCase,
    });
  });

  describe("POST /api/client/request", () => {
    it("creates a reservation request", async () => {
      const response = await request(app)
        .post("/api/client/request")
        .send({
          client_full_name: "John Doe",
          email: "john@example.com",
          phone: "1234567890",
          event_date_time: new Date().toISOString(),
          guest_count: 100,
          event_address: "123 Main St",
          services_ids: [1, 2],
        });

      expect(response.status).toBe(201);
      expect(response.body.data[0]).toHaveProperty("folio");
      expect(response.body.data[0].folio).toMatch(/^BD-\d{4}-\d{5}$/);
    });

    it("returns one error per invalid field", async () => {
      const response = await request(app).post("/api/client/request").send({
        client_full_name: "John123",
        email: "not-an-email",
        phone: "123",
        event_date_time: "2000-01-01T10:00:00.000Z",
        guest_count: 0,
        event_address: "",
        services_ids: [],
      });

      expect(response.status).toBe(422);
      expect(response.body.errors).toEqual(
        expect.objectContaining({
          client_full_name: expect.any(String),
          email: expect.any(String),
          phone: expect.any(String),
          event_date_time: expect.any(String),
          guest_count: expect.any(String),
          event_address: expect.any(String),
          services_ids: expect.any(String),
        })
      );
    });
  });

  it("checks first access through the authentication cookie", async () => {
    const response = await request(app)
      .get("/api/auth/first-access")
      .set("Cookie", "auth_token=valid-token");

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ firstAccess: true });
  });

  it("rejects bearer authentication", async () => {
    const response = await request(app)
      .get("/api/auth/first-access")
      .set("Authorization", "Bearer valid-token");

    expect(response.status).toBe(401);
  });

  it("keeps the client services route available", async () => {
    const response = await request(app).get("/api/client/services");

    expect(response.status).toBe(200);
    expect(response.body.data).toHaveLength(2);
    expect(response.body.data[0]).toMatchObject({ id: 1, nombre: "Catering" });
  });

  it("protects the admin reservation routes with the auth cookie", async () => {
    const response = await request(app).get("/api/admin/requests");

    expect(response.status).toBe(401);
  });
});
