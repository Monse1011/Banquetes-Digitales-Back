const jwt = require("jsonwebtoken");
const { SecurityConstants } = require("../../domain/constants/security");

class JwtTokenService {
  constructor({ secret, expiresIn = SecurityConstants.JWT_DEFAULT_TTL } = {}) {
    this.secret = secret;
    this.expiresIn = expiresIn;
  }

  generateToken(user, extraClaims = {}) {
    return jwt.sign(
      {
        id_user: user.id,
        id_employee: user.employeeId,
        role: user.role,
        ...extraClaims,
      },
      this.secret,
      {
        algorithm: SecurityConstants.JWT_ALGORITHM,
        expiresIn: this.expiresIn,
      }
    );
  }

  verifyToken(token) {
    const payload = jwt.verify(token, this.secret, {
      algorithms: [SecurityConstants.JWT_ALGORITHM],
    });
    const currentTime = Math.floor(Date.now() / 1000);

    if (!Number.isFinite(payload.exp) || payload.exp <= currentTime) {
      throw new Error("JWT expiration is invalid or expired");
    }

    return payload;
  }
}
module.exports = JwtTokenService;
