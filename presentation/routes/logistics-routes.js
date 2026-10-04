const express = require("express");
const UserRole = require("../../domain/enums/auth/user-role");
const requireRole = require("../middleware/auth/role-middleware");

function createLogisticsRoutes(humanResourceController, authMiddleware) {
  const router = express.Router();
  router.use(authMiddleware, requireRole(UserRole.LOGISTICA));

  router.get("/resources/human", (request, response, next) => {
    humanResourceController.listForLogistics(request, response).catch(next);
  });

  return router;
}

module.exports = createLogisticsRoutes;
