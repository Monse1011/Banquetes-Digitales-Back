const express = require("express");
const UserRole = require("../../domain/enums/auth/user-role");
const requireRole = require("../middleware/auth/role-middleware");

function registerResourceRoutes(router, path, controller) {
  router.get(path, (request, response, next) => {
    controller.list(request, response).catch(next);
  });

  router.post(path, (request, response, next) => {
    controller.create(request, response).catch(next);
  });

  router.get(`${path}/:id`, (request, response, next) => {
    controller.getById(request, response).catch(next);
  });

  router.patch(`${path}/:id`, (request, response, next) => {
    controller.update(request, response).catch(next);
  });

  router.put(`${path}/:id`, (request, response, next) => {
    controller.changeStatus(request, response).catch(next);
  });
}

function createAdminResourceRoutes(resourceControllers, authMiddleware) {
  const router = express.Router();
  // RF-1.2.8.9: los catálogos de recursos se restringen a Administrador General.
  router.use(authMiddleware, requireRole(UserRole.ADMIN));

  // Ver recursos por tipo (?type=)
  router.get("/", (request, response, next) => {
    resourceControllers.resource.list(request, response).catch(next);
  });

  registerResourceRoutes(router, "/human", resourceControllers.human);
  registerResourceRoutes(router, "/material", resourceControllers.material);
  registerResourceRoutes(router, "/logistic", resourceControllers.logistic);

  // El DAD solo define el borrado suave por DELETE para los recursos logísticos.
  router.delete("/logistic/:id", (request, response, next) => {
    resourceControllers.logistic.deactivate(request, response).catch(next);
  });

  return router;
}

module.exports = createAdminResourceRoutes;
