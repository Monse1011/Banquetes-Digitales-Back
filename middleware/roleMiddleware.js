function requireRole(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ message: "Usuario no autenticado" });
    if (!allowedRoles.includes(req.user.role))
      return res.status(403).json({ message: "No tienes permisos para realizar esta acción" });
    next();
  };
}
module.exports = requireRole;
