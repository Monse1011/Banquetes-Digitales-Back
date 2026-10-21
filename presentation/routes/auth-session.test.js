/* global vi */
const express = require("express");
const request = require("supertest");
const AuthController = require("../controller/auth/auth-controller");
const createAuthRoutes = require("./auth-routes");
const createAuthMiddleware = require("../middleware/auth/auth-middleware");
const JwtTokenService = require("../../infrastructure/security/jwt-token-service");

const tokens = new JwtTokenService({ secret: "session-test-secret", expiresIn: "1h" });
const makeUser = (role = "ADMIN") => ({ id: 1, employeeId: "371", fullName: "Test", email: "test@example.com", role, status: "active", passwordHash: "private", isFirstAccess: () => false });
function setup(user, service = tokens) {
  const repository = { findById: vi.fn(async () => user) };
  const controller = new AuthController({}, {}, repository);
  const app = express();
  app.use("/api/auth", createAuthRoutes(controller, createAuthMiddleware(service), { requestReset: (_req, res) => res.end(), resetPassword: (_req, res) => res.end() }));
  return { app, repository };
}
describe("Cookie session recovery", () => {
  it.each(["ADMIN", "LOGISTICS"])("restores %s from a verified cookie without exposing credentials", async (role) => {
    const user = makeUser(role);
    const { app, repository } = setup(user);
    const response = await request(app).get("/api/auth/session").set("Cookie", `auth_token=${tokens.generateToken(user)}`);
    expect(response.status).toBe(200);
    expect(repository.findById).toHaveBeenCalledWith(1);
    expect(response.body).toEqual({ user: { id_user: 1, id_employee: "371", full_name: "Test", email: "test@example.com", role }, firstAccess: false });
    expect(response.headers["cache-control"]).toBe("no-store");
  });
  it.each([null, "invalid"])("rejects missing or invalid credentials: %s", async (cookie) => {
    const { app, repository } = setup(makeUser());
    const call = request(app).get("/api/auth/session");
    if (cookie) call.set("Cookie", `auth_token=${cookie}`);
    expect((await call).status).toBe(401);
    expect(repository.findById).not.toHaveBeenCalled();
  });
  it("rejects an expired cookie", async () => {
    const { app } = setup(makeUser());
    const expired = new JwtTokenService({ secret: "session-test-secret", expiresIn: -1 });
    expect((await request(app).get("/api/auth/session").set("Cookie", `auth_token=${expired.generateToken(makeUser())}`)).status).toBe(401);
  });
  it.each([null, { ...makeUser(), status: "inactive" }, makeUser("LOGISTICS")])("rejects a removed, disabled or changed-role account", async (user) => {
    const { app } = setup(user);
    expect((await request(app).get("/api/auth/session").set("Cookie", `auth_token=${tokens.generateToken(makeUser())}`)).status).toBe(401);
  });
  it("reports first access without granting the frontend a normal session", async () => {
    const { app } = setup({ ...makeUser(), isFirstAccess: () => true });
    const result = await request(app).get("/api/auth/session").set("Cookie", `auth_token=${tokens.generateToken(makeUser())}`);
    expect(result.body.firstAccess).toBe(true);
  });
  it("distinguishes database failure from expiration", async () => {
    const { app, repository } = setup(makeUser());
    repository.findById.mockRejectedValue(new Error("database unavailable"));
    expect((await request(app).get("/api/auth/session").set("Cookie", `auth_token=${tokens.generateToken(makeUser())}`)).status).toBe(500);
  });
  it("logout expires the HttpOnly cookie even if the session already expired", async () => {
    const { app } = setup(makeUser());
    const result = await request(app).post("/api/auth/logout");
    expect(result.status).toBe(204);
    expect(result.headers["set-cookie"][0]).toMatch(/auth_token=;.*Path=\/;.*Expires=.*1970.*HttpOnly.*SameSite=Lax/);
  });
});
