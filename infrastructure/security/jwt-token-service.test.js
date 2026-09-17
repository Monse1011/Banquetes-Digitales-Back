const jwt = require("jsonwebtoken");
const JwtTokenService = require("./jwt-token-service");

describe("JwtTokenService", () => {
  const secret = "test-secret";
  let tokenService;

  beforeEach(() => {
    process.env.JWT_SECRET = secret;
    tokenService = new JwtTokenService({ secret });
  });

  it("rejects an expired token", () => {
    const token = jwt.sign({ id_user: 1 }, secret, { expiresIn: -1 });

    expect(() => tokenService.verifyToken(token)).toThrow();
  });

  it("rejects a token without an expiration claim", () => {
    const token = jwt.sign({ id_user: 1 }, secret);

    expect(() => tokenService.verifyToken(token)).toThrow("expiration is invalid");
  });
});
