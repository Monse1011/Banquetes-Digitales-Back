const express = require("express");
const UserRole = require("../../domain/enums/auth/user-role");
const requireRole = require("../middleware/auth/role-middleware");

function createAdminRoutes(reservationRequestController, authMiddleware) {
  const router = express.Router();
  router.use(authMiddleware, requireRole(UserRole.ADMIN));

  router.get("/requests", (request, response, next) => {
    reservationRequestController.list(request, response).catch(next);
  });

  router.get("/requests/:id", (request, response, next) => {
    reservationRequestController.getById(request, response).catch(next);
  });

  router.patch("/requests/:id", (request, response, next) => {
    reservationRequestController.approve(request, response).catch(next);
  });

  return router;
}

module.exports = createAdminRoutes;
