const express = require("express");
const UserRole = require("../../domain/enums/auth/user-role");
const requireRole = require("../middleware/auth/role-middleware");

// Contratos 13, 14 y 15 (función 2.15): módulo de reportes, solo Administrador General
// (RF-1.2.15.1). Sin sesión → 401 y con rol distinto → 403 con los mensajes del DAD.
function createAdminReportRoutes(reportController, authMiddleware) {
  const router = express.Router();

  router.use(authMiddleware, requireRole(UserRole.ADMIN));

  router.get("/reports", (request, response, next) => {
    reportController.report(request, response).catch(next);
  });

  router.get("/reports/export", (request, response, next) => {
    reportController.export(request, response).catch(next);
  });

  router.get("/clients", (request, response, next) => {
    reportController.clients(request, response).catch(next);
  });

  return router;
}

module.exports = createAdminReportRoutes;
