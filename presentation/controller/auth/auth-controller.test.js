/* global vi */
const AuthController = require("./auth-controller");

describe("AuthController", () => {
  it("stores the login JWT in an HttpOnly cookie instead of the response body", async () => {
    const authController = new AuthController({
      execute: async () => ({
        token: "jwt-token",
        user: { id_user: 1 },
      }),
    });
    const response = {
      cookie: vi.fn(),
      status: vi.fn().mockReturnThis(),
      json: vi.fn().mockReturnThis(),
    };

    await authController.login(
      { body: { employeeId: "E-001", password: "password" } },
      response
    );

    expect(response.cookie).toHaveBeenCalledWith(
      "auth_token",
      "jwt-token",
      expect.objectContaining({
        httpOnly: true,
        sameSite: "lax",
        path: "/",
      })
    );
    expect(response.json).toHaveBeenCalledWith({ user: { id_user: 1 } });
    expect(response.json.mock.calls[0][0]).not.toHaveProperty("token");
  });
});