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
  InMemoryUserRepository,
} = require("../infrastructure/repositories/auth/in-memory-user-repository");
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
  AssignReservationRequestUseCase,
} = require("../application/use-cases/reservation-request/assign-reservation-request-use-case");
const {
  GetAvailableLogisticsUsersUseCase,
} = require("../application/use-cases/reservation-request/get-available-logistics-users-use-case");
const { Service } = require("../domain/entities/service/service");
const User = require("../domain/entities/auth/user");
const UserRole = require("../domain/enums/auth/user-role");
const UserStatus = require("../domain/enums/auth/user-status");

describe("App", () => {
  let app;
  let reservationRequestRepository;
  let currentUserId;
  let currentUserRole;

  function buildApp() {
    currentUserId = 1;
    currentUserRole = UserRole.ADMIN;

    const clientRepository = new InMemoryClientRepository();
    const serviceRepository = new InMemoryServiceRepository([
      new Service(1, "Catering", "Servicio de catering", "activo"),
      new Service(2, "Decoración", "Servicio de decoración", "activo"),
    ]);
    reservationRequestRepository = new InMemoryReservationRequestRepository();
    const userRepository = new InMemoryUserRepository([
      new User(
        7,
        "EMP-007",
        "David Torres",
        "david@example.com",
        "$2b$hash",
        UserRole.LOGISTICS,
        UserStatus.ACTIVE,
        new Date(),
        new Date()
      ),
      new User(
        8,
        "EMP-008",
        "Cesar Huerta",
        "cesar@example.com",
        "$2b$hash",
        UserRole.LOGISTICS,
        UserStatus.ACTIVE,
        new Date(),
        new Date()
      ),
    ]);
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
    const assignReservationRequestUseCase = new AssignReservationRequestUseCase(
      reservationRequestRepository,
      userRepository
    );
    const getAvailableLogisticsUsersUseCase = new GetAvailableLogisticsUsersUseCase(userRepository);

    app = createApp({
      authController: {
        session: (_req, res) => res.sendStatus(501),
        logout: (_req, res) => res.sendStatus(501),
        login: (_req, res) => res.status(200).json({}),
        changePassword: (_req, res) => res.status(200).json({}),
        firstAccess: (_req, res) => res.status(200).json({ firstAccess: true }),
      },
      passwordResetController: {
        requestReset: (_req, res) => res.status(200).json({}),
        resetPassword: (_req, res) => res.status(200).json({}),
      },
      tokenService: {
        verifyToken: () => ({ id_user: currentUserId, role: currentUserRole }),
      },
      clientRepository,
      serviceRepository,
      reservationRequestRepository,
      folioGenerator,
      upsertClientByEmailUseCase,
      createReservationRequestUseCase,
      approveReservationRequestUseCase,
      assignReservationRequestUseCase,
      getAvailableLogisticsUsersUseCase,
    });
  }

  beforeEach(buildApp);

  async function createApprovedRequest() {
    await request(app)
      .post("/api/client/request")
      .send({
        client_full_name: "John Doe",
        email: "john@example.com",
        phone: "1234567890",
        event_date_time: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
        event_end_time: new Date(Date.now() + 26 * 60 * 60 * 1000).toISOString(),
        guest_count: 100,
        event_address: "123 Main St",
        services_ids: [1, 2],
      });

    const { requests } = await reservationRequestRepository.findAll({}, {}, 1, 10);
    const { requestId } = requests[0];

    await request(app)
      .patch(`/api/admin/requests/${requestId}`)
      .set("Cookie", "auth_token=valid-token")
      .send({ status: "Aprobada" });

    return requestId;
  }

  describe("POST /api/client/request", () => {
    it("creates a reservation request", async () => {
      const response = await request(app)
        .post("/api/client/request")
        .send({
          client_full_name: "John Doe",
          email: "john@example.com",
          phone: "1234567890",
          event_date_time: new Date().toISOString(),
          event_end_time: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(),
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
        event_end_time: "2000-01-01T09:00:00.000Z",
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
          event_end_time: expect.any(String),
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

  describe("Función 2.4 - Asignación de eventos", () => {
    it("rejects assignment when the user is not an admin (RF-1.2.4.16)", async () => {
      const requestId = await createApprovedRequest();
      currentUserRole = UserRole.LOGISTICS;

      const response = await request(app)
        .patch(`/api/admin/requests/${requestId}/assignment`)
        .set("Cookie", "auth_token=valid-token")
        .send({ data: { user_id: 7 } });

      expect(response.status).toBe(403);
    });

    it("assigns an approved request to an active logistic user (RF-1.2.4.1/3/14)", async () => {
      const requestId = await createApprovedRequest();

      const response = await request(app)
        .patch(`/api/admin/requests/${requestId}/assignment`)
        .set("Cookie", "auth_token=valid-token")
        .send({ data: { user_id: 7 } });

      expect(response.status).toBe(200);

      const assigned = await reservationRequestRepository.findById(requestId);
      expect(assigned.status).toBe("Asignada");
      expect(assigned.logisticUserId).toBe(7);
      expect(assigned.assignedByUserId).toBe(1);
      expect(assigned.assignedAt).toBeInstanceOf(Date);
    });

    it("assigns a request that is still pending (todos los estados salvo Confirmado)", async () => {
      await request(app)
        .post("/api/client/request")
        .send({
          client_full_name: "John Doe",
          email: "john@example.com",
          phone: "1234567890",
          event_date_time: new Date().toISOString(),
          event_end_time: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(),
          guest_count: 100,
          event_address: "123 Main St",
          services_ids: [1],
        });
      const { requests } = await reservationRequestRepository.findAll({}, {}, 1, 10);

      const response = await request(app)
        .patch(`/api/admin/requests/${requests[0].requestId}/assignment`)
        .set("Cookie", "auth_token=valid-token")
        .send({ data: { user_id: 7 } });

      expect(response.status).toBe(200);
    });

    it("reassigns a request in Asignada state to another available user", async () => {
      const requestId = await createApprovedRequest();
      await request(app)
        .patch(`/api/admin/requests/${requestId}/assignment`)
        .set("Cookie", "auth_token=valid-token")
        .send({ data: { user_id: 7 } });

      const response = await request(app)
        .patch(`/api/admin/requests/${requestId}/assignment`)
        .set("Cookie", "auth_token=valid-token")
        .send({ data: { user_id: 8, request_id: 7 } });

      expect(response.status).toBe(200);
      expect((await reservationRequestRepository.findById(requestId)).logisticUserId).toBe(8);
    });

    it("rejects reassignment when the shown responsible is stale (RF-1.2.4.7)", async () => {
      const requestId = await createApprovedRequest();
      await request(app)
        .patch(`/api/admin/requests/${requestId}/assignment`)
        .set("Cookie", "auth_token=valid-token")
        .send({ data: { user_id: 7 } });

      const response = await request(app)
        .patch(`/api/admin/requests/${requestId}/assignment`)
        .set("Cookie", "auth_token=valid-token")
        .send({ data: { user_id: 8, request_id: 99 } });

      expect(response.status).toBe(409);
      expect(response.body.message).toBe("La solicitud ya fue asignada.");
    });

    it("blocks reassignment when the request is Confirmado", async () => {
      const requestId = await createApprovedRequest();
      await request(app)
        .patch(`/api/admin/requests/${requestId}/assignment`)
        .set("Cookie", "auth_token=valid-token")
        .send({ data: { user_id: 7 } });
      const assigned = await reservationRequestRepository.findById(requestId);
      assigned.status = "Confirmado";

      const response = await request(app)
        .patch(`/api/admin/requests/${requestId}/assignment`)
        .set("Cookie", "auth_token=valid-token")
        .send({ data: { user_id: 8, request_id: 7 } });

      expect(response.status).toBe(409);
      expect(response.body.message).toBe(
        "La solicitud no puede ser reasignada en su estado actual."
      );
    });

    it("rejects an invalid current responsible identifier with 400", async () => {
      const requestId = await createApprovedRequest();

      const response = await request(app)
        .patch(`/api/admin/requests/${requestId}/assignment`)
        .set("Cookie", "auth_token=valid-token")
        .send({ data: { user_id: 7, request_id: "abc" } });

      expect(response.status).toBe(400);
    });

    it("rejects users that are not available with the RF message (RF-1.2.4.5)", async () => {
      const requestId = await createApprovedRequest();

      const response = await request(app)
        .patch(`/api/admin/requests/${requestId}/assignment`)
        .set("Cookie", "auth_token=valid-token")
        .send({ data: { user_id: 999 } });

      expect(response.status).toBe(409);
      expect(response.body.message).toBe(
        "El empleado seleccionado no se encuentra disponible para esta solicitud."
      );
    });

    it("rejects invalid or missing user identifier with 400", async () => {
      const requestId = await createApprovedRequest();

      const response = await request(app)
        .patch(`/api/admin/requests/${requestId}/assignment`)
        .set("Cookie", "auth_token=valid-token")
        .send({ data: {} });

      expect(response.status).toBe(400);
    });

    it("lists active logistics users for assignment (RF-1.2.4.10/12)", async () => {
      const response = await request(app)
        .get("/api/admin/users/usersavailable")
        .set("Cookie", "auth_token=valid-token");

      expect(response.status).toBe(200);
      expect(response.body.data.users).toEqual([
        { id: 8, employee_id: "EMP-008", full_name: "Cesar Huerta" },
        { id: 7, employee_id: "EMP-007", full_name: "David Torres" },
      ]);
    });
  });
});
