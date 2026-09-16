const AuthMessages = require("../../constants/auth-messages");

function requireRole(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ message: AuthMessages.AUTHENTICATION_REQUIRED });
    if (!allowedRoles.includes(req.user.role))
      return res.status(403).json({ message: AuthMessages.FORBIDDEN });
    next();
  };
}

module.exports = requireRole;
