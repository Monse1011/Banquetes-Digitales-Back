const { Router } = require("express");
const requireRole = require("../middleware/auth/role-middleware");
const UserRole = require("../../domain/enums/auth/user-role");

function createLogisticsCalendarRoutes(calendarController, authMiddleware) {
  const router = Router();
  const requireAdminOrLogistics = requireRole(UserRole.ADMIN, UserRole.LOGISTICS);

  router.use(authMiddleware, requireAdminOrLogistics);
  router.get("/calendar", calendarController.list.bind(calendarController));
  router.post("/requests/:id/calendar", calendarController.schedule.bind(calendarController));
  router.post("/calendar/:id/sync", calendarController.retrySync.bind(calendarController));
  router.patch("/calendar/:id", calendarController.edit.bind(calendarController));
  router.delete("/calendar/:id", calendarController.cancel.bind(calendarController));

  router.all("/calendar", (_request, response) => response.sendStatus(404));
  router.all("/requests/:id/calendar", (_request, response) => response.sendStatus(404));
  router.all("/calendar/:id", (_request, response) => response.sendStatus(404));

  return router;
}

function createAdminCalendarRoutes(calendarController, authMiddleware) {
  const router = Router();

  router.use(authMiddleware, requireRole(UserRole.ADMIN));
  router.get("/calendar", calendarController.list.bind(calendarController));

  return router;
}

module.exports = { createLogisticsCalendarRoutes, createAdminCalendarRoutes };
