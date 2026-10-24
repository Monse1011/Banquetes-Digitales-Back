/* global vi */
const request = require("supertest");
const { createApp } = require("../app");
const InMemoryUserRepository = require("../../infrastructure/repositories/user/in-memory-user-repository");
const ResendUserCredentialsUseCase = require("../../application/use-cases/user/resend-user-credentials-use-case");
const CreateUserUseCase = require("../../application/use-cases/user/create-user-use-case");
const UpdateUserUseCase = require("../../application/use-cases/user/update-user-use-case");
const ToggleUserStatusUseCase = require("../../application/use-cases/user/toggle-user-status-use-case");
const GetUserByIdUseCase = require("../../application/use-cases/user/get-user-by-id-use-case");
const ListUsersUseCase = require("../../application/use-cases/user/list-users-use-case");
const {
  GetAvailableLogisticsUsersUseCase,
} = require("../../application/use-cases/reservation-request/get-available-logistics-users-use-case");
const UserRole = require("../../domain/enums/auth/user-role");
const UserStatus = require("../../domain/enums/user/user-status");

describe("Admin User Routes (Función 2.12 - DAD API Contracts)", () => {
  let app;
  let userRepository;
  let emailService;
  let currentUserId;
  let currentUserRole;

  beforeEach(() => {
    currentUserId = 1;
    currentUserRole = UserRole.ADMIN;

    userRepository = new InMemoryUserRepository();
    emailService = {
      sendCredentials: vi.fn().mockResolvedValue(true),
    };

    const createUserUseCase = new CreateUserUseCase({ userRepository, emailService });
    const updateUserUseCase = new UpdateUserUseCase({ userRepository });
    const toggleUserStatusUseCase = new ToggleUserStatusUseCase({ userRepository });
    const getUserByIdUseCase = new GetUserByIdUseCase({ userRepository });
    const listUsersUseCase = new ListUsersUseCase({ userRepository });
    const resendUserCredentialsUseCase = new ResendUserCredentialsUseCase({
      userRepository,
      emailService,
    });
    const getAvailableLogisticsUsersUseCase = new GetAvailableLogisticsUsersUseCase(userRepository);

    app = createApp({
      tokenService: {
        verifyToken: () => ({ id_user: currentUserId, role: currentUserRole }),
      },
      createUserUseCase,
      resendUserCredentialsUseCase,
      updateUserUseCase,
      toggleUserStatusUseCase,
      getUserByIdUseCase,
      listUsersUseCase,
      getAvailableLogisticsUsersUseCase,
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
      serviceRepository: { findAll: () => [] },
      resourceUseCases: {},
      humanResourceUseCases: {},
      materialResourceUseCases: {},
      logisticResourceUseCases: {},
    });
  });

  it("POST /api/admin/users creates user with 201 Created and Location header", async () => {
    const response = await request(app)
      .post("/api/admin/users")
      .set("Cookie", ["auth_token=valid"])
      .send({
        data: {
          full_name: "Ana López",
          email: "ana@banquetes.com",
          role: "LOGISTICS",
        },
      });

    expect(response.status).toBe(201);
    expect(response.headers.location).toMatch(/^\/api\/admin\/users\/\d+$/);
    expect(response.body.data.user.full_name).toBe("Ana López");
    expect(response.body.data.user.role).toBe(UserRole.LOGISTICS);
    expect(response.body.data.user.status).toBe(UserStatus.ACTIVE);
  });

  it("POST /api/admin/users returns 409 if email already exists", async () => {
    await request(app)
      .post("/api/admin/users")
      .set("Cookie", ["auth_token=valid"])
      .send({
        data: {
          full_name: "User One",
          email: "duplicate@test.com",
          role: "LOGISTICS",
        },
      });

    const duplicateResponse = await request(app)
      .post("/api/admin/users")
      .set("Cookie", ["auth_token=valid"])
      .send({
        data: {
          full_name: "User Two",
          email: "duplicate@test.com",
          role: "ADMIN",
        },
      });

    expect(duplicateResponse.status).toBe(409);
    expect(duplicateResponse.body.message).toContain("Ya existe un usuario registrado");
  });

  it("POST /api/admin/users returns 502 when email service fails (NC 10)", async () => {
    emailService.sendCredentials.mockRejectedValueOnce(new Error("SMTP down"));

    const response = await request(app)
      .post("/api/admin/users")
      .set("Cookie", ["auth_token=valid"])
      .send({
        data: {
          full_name: "Failed Mail",
          email: "failedmail@test.com",
          role: "LOGISTICS",
        },
      });

    expect(response.status).toBe(502);
    expect(response.body.message).toContain("no se pudo enviar el correo");
  });

  it("POST /api/admin/users/:id/credentials resends credentials with 204 (RF-1.2.12.3)", async () => {
    const created = await request(app)
      .post("/api/admin/users")
      .set("Cookie", ["auth_token=valid"])
      .send({ data: { full_name: "Reenvio", email: "reenvio@test.com", role: "LOGISTICS" } });
    expect(created.status).toBe(201);
    const id = Number(created.headers.location.split("/").pop());
    emailService.sendCredentials.mockClear();

    const response = await request(app)
      .post(`/api/admin/users/${id}/credentials`)
      .set("Cookie", ["auth_token=valid"]);

    expect(response.status).toBe(204);
    expect(emailService.sendCredentials).toHaveBeenCalledTimes(1);
  });

  it("POST /api/admin/users/:id/credentials returns 404 for an unknown user", async () => {
    const response = await request(app)
      .post("/api/admin/users/9999/credentials")
      .set("Cookie", ["auth_token=valid"]);
    expect(response.status).toBe(404);
  });

  it("GET /api/admin/users returns paginated users", async () => {
    await request(app)
      .post("/api/admin/users")
      .set("Cookie", ["auth_token=valid"])
      .send({
        data: { full_name: "Cesar Huerta", email: "cesar@banquetes.com", role: "LOGISTICS" },
      });

    const response = await request(app)
      .get("/api/admin/users?page=1&per_page=10")
      .set("Cookie", ["auth_token=valid"]);

    expect(response.status).toBe(200);
    expect(response.body.data.users).toBeInstanceOf(Array);
    expect(response.body.data.users.length).toBeGreaterThanOrEqual(1);
    expect(response.body.metadata.pagination.total_records).toBeGreaterThanOrEqual(1);
  });

  it("GET /api/admin/users/:id returns user details", async () => {
    const createRes = await request(app)
      .post("/api/admin/users")
      .set("Cookie", ["auth_token=valid"])
      .send({
        data: { full_name: "Detail User", email: "detail@banquetes.com", role: "LOGISTICS" },
      });

    const userId = createRes.body.data.user.id;
    const response = await request(app)
      .get(`/api/admin/users/${userId}`)
      .set("Cookie", ["auth_token=valid"]);

    expect(response.status).toBe(200);
    expect(response.body.data.user.id).toBe(userId);
    expect(response.body.data.user.full_name).toBe("Detail User");
  });

  it("PATCH /api/admin/users/:id updates user details", async () => {
    const createRes = await request(app)
      .post("/api/admin/users")
      .set("Cookie", ["auth_token=valid"])
      .send({
        data: { full_name: "Original Name", email: "orig@banquetes.com", role: "LOGISTICS" },
      });

    const userId = createRes.body.data.user.id;
    const response = await request(app)
      .patch(`/api/admin/users/${userId}`)
      .set("Cookie", ["auth_token=valid"])
      .send({
        data: { full_name: "Updated Name", role: "ADMIN" },
      });

    expect(response.status).toBe(200);
    expect(response.body.data.user.full_name).toBe("Updated Name");
    expect(response.body.data.user.role).toBe(UserRole.ADMIN);
  });

  it("PUT /api/admin/users/:id toggles user status", async () => {
    // create two admins so one can be deactivated
    await request(app)
      .post("/api/admin/users")
      .set("Cookie", ["auth_token=valid"])
      .send({
        data: { full_name: "Admin One", email: "admin1@test.com", role: "ADMIN" },
      });
    const admin2Res = await request(app)
      .post("/api/admin/users")
      .set("Cookie", ["auth_token=valid"])
      .send({
        data: { full_name: "Admin Two", email: "admin2@test.com", role: "ADMIN" },
      });

    const targetId = admin2Res.body.data.user.id;
    const response = await request(app)
      .put(`/api/admin/users/${targetId}`)
      .set("Cookie", ["auth_token=valid"])
      .send({
        data: { status: "INACTIVE" },
      });

    expect(response.status).toBe(200);
  });
});
