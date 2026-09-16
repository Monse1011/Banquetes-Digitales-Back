const request = require("supertest");
const { createApp } = require("./app");

describe("Authentication app", () => {
  let app;

  beforeEach(() => {
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
      serviceRepository: { findAll: async () => [] },
      createReservationRequestUseCase: { execute: async () => ({}) },
      getReservationRequestsUseCase: { execute: async () => ({}) },
      getReservationRequestUseCase: { execute: async () => ({}) },
      approveReservationRequestUseCase: { execute: async () => ({}) },
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
    expect(response.body).toEqual({ data: [] });
  });

  it("protects the admin reservation routes with the auth cookie", async () => {
    const response = await request(app).get("/api/admin/requests");

    expect(response.status).toBe(401);
  });
});
