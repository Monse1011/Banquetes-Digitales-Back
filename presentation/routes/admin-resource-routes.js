const express = require("express");
const UserRole = require("../../domain/enums/auth/user-role");
const requireRole = require("../middleware/auth/role-middleware");

function createAdminResourceRoutes(humanResourceController, authMiddleware) {
  const router = express.Router();
  // RF-1.2.8.9: el catálogo de recursos humanos se restringe a Administrador General.
  router.use(authMiddleware, requireRole(UserRole.ADMIN));

  router.get("/human", (request, response, next) => {
    humanResourceController.list(request, response).catch(next);
  });

  router.post("/human", (request, response, next) => {
    humanResourceController.create(request, response).catch(next);
  });

  router.get("/human/:id", (request, response, next) => {
    humanResourceController.getById(request, response).catch(next);
  });

  router.patch("/human/:id", (request, response, next) => {
    humanResourceController.update(request, response).catch(next);
  });

  router.put("/human/:id", (request, response, next) => {
    humanResourceController.changeStatus(request, response).catch(next);
  });

  return router;
}

module.exports = createAdminResourceRoutes;
