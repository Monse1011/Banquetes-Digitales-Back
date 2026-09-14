const jwt = require("jsonwebtoken");

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
      { expiresIn: process.env.JWT_EXPIRES_IN || "1h" }
    );
  }

  verifyToken(token) {
    return jwt.verify(token, process.env.JWT_SECRET);
  }
}
module.exports = JwtTokenService;
