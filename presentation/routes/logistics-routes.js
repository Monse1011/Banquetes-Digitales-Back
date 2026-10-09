const express = require("express");
const UserRole = require("../../domain/enums/auth/user-role");
const requireRole = require("../middleware/auth/role-middleware");
const {
  ReservationRequestController,
} = require("../controller/reservation-request/reservation-request-controller");

function createLogisticsRoutes(resourceControllers, authMiddleware, reservationRequestController) {
  const router = express.Router();
  router.use(authMiddleware, requireRole(UserRole.LOGISTICA));

  ["human", "material", "logistic"].forEach((type) => {
    router.get(`/resources/${type}`, (request, response, next) => {
      resourceControllers[type].listForLogistics(request, response).catch(next);
    });
  });

  const reqController = reservationRequestController || new ReservationRequestController({});

  router.get("/requests/history", (request, response, next) => {
    reqController.listHistoryForLogistics(request, response).catch(next);
  });

  router.get("/requests", (request, response, next) => {
    reqController.listForLogistics(request, response).catch(next);
  });

  router.get("/requests/:id", (request, response, next) => {
    reqController.getByIdForLogistics(request, response).catch(next);
  });

  return router;
}

module.exports = createLogisticsRoutes;
