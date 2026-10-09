const { Router } = require("express");
const requireRole = require("../middleware/auth/role-middleware");
const UserRole = require("../../domain/enums/auth/user-role");

function createCalendarRoutes(calendarController, authMiddleware) {
  const router = Router();

  // Middleware de autenticación global para estas rutas
  router.use(authMiddleware);

  const requireAdminOrLogistics = requireRole(UserRole.ADMIN, UserRole.LOGISTICA);

  // E. Consulta del calendario (Admin y Logística)
  router.get("/", requireAdminOrLogistics, calendarController.list.bind(calendarController));

  // A. Agendar un evento (Admin o el responsable de logística)
  router.post("/", requireAdminOrLogistics, calendarController.schedule.bind(calendarController));

  // C. Edición de eventos confirmados (Admin o el responsable)
  router.put("/:id", requireAdminOrLogistics, calendarController.edit.bind(calendarController));

  // D. Cancelación de eventos (Admin o el responsable)
  router.delete(
    "/:id",
    requireAdminOrLogistics,
    calendarController.cancel.bind(calendarController)
  );

  // B. Sincronización con Google Calendar (Reintento manual)
  router.post(
    "/:id/sync",
    requireAdminOrLogistics,
    calendarController.retrySync.bind(calendarController)
  );

  return router;
}

module.exports = { createCalendarRoutes };
