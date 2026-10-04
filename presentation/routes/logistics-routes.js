const express = require("express");
const UserRole = require("../../domain/enums/auth/user-role");
const requireRole = require("../middleware/auth/role-middleware");

function createLogisticsRoutes(resourceControllers, authMiddleware) {
  const router = express.Router();
  router.use(authMiddleware, requireRole(UserRole.LOGISTICA));

  ["human", "material", "logistic"].forEach((type) => {
    router.get(`/resources/${type}`, (request, response, next) => {
      resourceControllers[type].listForLogistics(request, response).catch(next);
    });
  });

  return router;
}

module.exports = createLogisticsRoutes;
