const express = require("express");
const UserRole = require("../../domain/enums/auth/user-role");
const requireRole = require("../middleware/auth/role-middleware");

function createLogisticsRoutes(resourceControllers, authMiddleware) {
  const router = express.Router();
  const assignmentController = resourceControllers.assignment;
  // RF-2.3.2.21: la confirmación de recursos también la puede realizar el Administrador General.
  router.use(authMiddleware, requireRole(UserRole.LOGISTICA, UserRole.ADMIN));

  ["human", "material", "logistic"].forEach((type) => {
    router.get(`/resources/${type}`, (request, response, next) => {
      // Con ?request_id= agrega la disponibilidad para el periodo del evento (Función 3.2).
      if (request.query.request_id !== undefined) {
        assignmentController
          .listResources(request, response, resourceControllers[type])
          .catch(next);
        return;
      }

      resourceControllers[type].listForLogistics(request, response).catch(next);
    });
  });

  router.post("/requests/:id/resources", (request, response, next) => {
    assignmentController.assign(request, response).catch(next);
  });

  router.delete("/requests/:id/resources/:resourceId", (request, response, next) => {
    assignmentController.release(request, response).catch(next);
  });

  router.post("/requests/:id/resources/confirm", (request, response, next) => {
    assignmentController.confirm(request, response).catch(next);
  });

  router.post("/requests/:id/resources/cancel", (request, response, next) => {
    assignmentController.cancel(request, response).catch(next);
  });

  return router;
}

module.exports = createLogisticsRoutes;
