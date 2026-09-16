const jwt = require("jsonwebtoken");
const { SecurityConstants } = require("../../domain/constants/security");

class JwtTokenService {
  generateToken(user, extraClaims = {}) {
    return jwt.sign(
      {
        id_user: user.id,
        id_employee: user.employeeId,
        role: user.role,
        ...extraClaims,
      },
      process.env.JWT_SECRET,
      {
        algorithm: SecurityConstants.JWT_ALGORITHM,
        expiresIn: process.env.JWT_EXPIRES_IN || SecurityConstants.JWT_DEFAULT_TTL,
      }
    );
  }

  verifyToken(token) {
    const payload = jwt.verify(token, process.env.JWT_SECRET, {
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
