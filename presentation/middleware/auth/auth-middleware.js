const { SecurityConstants } = require("../../../domain/constants/security");
const AuthMessages = require("../../constants/auth-messages");

function getCookie(request, name) {
  const cookies = request.headers.cookie ? request.headers.cookie.split(";") : [];
  const cookie = cookies.find((entry) => entry.trim().startsWith(`${name}=`));
  return cookie ? decodeURIComponent(cookie.trim().slice(name.length + 1)) : null;
}

function createAuthMiddleware(tokenService) {
  return (req, res, next) => {
    try {
      const token = getCookie(req, SecurityConstants.AUTH_COOKIE_NAME);
      if (!token) return res.status(401).json({ message: AuthMessages.TOKEN_MISSING });
      req.user = tokenService.verifyToken(token);
      next();
    } catch (error) {
      return res.status(401).json({ message: AuthMessages.TOKEN_INVALID });
    }
  };
}
module.exports = createAuthMiddleware;
