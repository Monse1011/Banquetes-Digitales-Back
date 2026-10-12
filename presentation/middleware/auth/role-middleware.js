const AuthMessages = require("../../constants/auth-messages");

function requireRole(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user) {
      console.warn("Authorization failed: user is not authenticated");
      return res.status(401).json({ message: AuthMessages.AUTHENTICATION_REQUIRED });
    }
    const userRole = req.user.role ? String(req.user.role).toUpperCase() : "";
    const isAllowed = allowedRoles.some((allowed) => {
      const normAllowed = String(allowed).toUpperCase();
      if (userRole === normAllowed) return true;
      const isUserLogistics = ["LOGISTICS", "LOGISTIC", "LOGISTICA"].includes(userRole);
      const isAllowedLogistics = ["LOGISTICS", "LOGISTIC", "LOGISTICA"].includes(normAllowed);
      return isUserLogistics && isAllowedLogistics;
    });

    if (!isAllowed) {
      console.warn(`Authorization failed: role ${req.user.role} is not allowed`);
      return res.status(403).json({ message: AuthMessages.FORBIDDEN });
    }
    next();
  };
}

module.exports = requireRole;
