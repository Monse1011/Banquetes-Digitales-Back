const express = require("express");
const UserRole = require("../../domain/enums/auth/user-role");
const requireRole = require("../middleware/auth/role-middleware");

function createLogisticsRoutes(resourceControllers, authMiddleware, proposalControllers = {}) {
  const router = express.Router();
  router.use(authMiddleware, requireRole(UserRole.LOGISTICA));

  ["human", "material", "logistic"].forEach((type) => {
    router.get(`/resources/${type}`, (request, response, next) => {
      resourceControllers[type].listForLogistics(request, response).catch(next);
    });
  });

  const { agreementsController, proposalController } = proposalControllers;

  // Función 3.4 - Contacto con el cliente.
  router.get("/requests/:id", (request, response, next) => {
    agreementsController.getRequestAgreements(request, response).catch(next);
  });

  router.post("/requests/:id/derived-information", (request, response, next) => {
    agreementsController.saveAgreements(request, response).catch(next);
  });

  router.post("/requests/:id/proposals", (request, response, next) => {
    proposalController.generate(request, response).catch(next);
  });

  router.get("/requests/:id/proposals", (request, response, next) => {
    proposalController.get(request, response).catch(next);
  });

  router.get("/requests/:id/proposals/download", (request, response, next) => {
    proposalController.download(request, response).catch(next);
  });

  router.post("/requests/:id/proposals/send", (request, response, next) => {
    proposalController.send(request, response).catch(next);
  });

  return router;
}

module.exports = createLogisticsRoutes;
