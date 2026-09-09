const jwt = require("jsonwebtoken");

function requireAdmin(request, response, next) {
  const authorization = request.header("authorization");
  const token = authorization?.startsWith("Bearer ")
    ? authorization.slice("Bearer ".length)
    : undefined;
  const secret = process.env.JWT_SECRET;

  if (!token || !secret) {
    response.status(401).json({ error: "Unauthorized" });
    return;
  }

  try {
    const payload = jwt.verify(token, secret);

    if (payload.role !== "Administrador") {
      response.status(403).json({ error: "Forbidden" });
      return;
    }

    next();
  } catch {
    response.status(401).json({ error: "Unauthorized" });
  }
}

module.exports = { requireAdmin };
