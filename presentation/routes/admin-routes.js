const express = require("express");

function createAdminRoutes(reservationRequestController, requireAdminAccess) {
  const router = express.Router();

  router.get("/requests", requireAdminAccess, (request, response, next) => {
    reservationRequestController.list(request, response).catch(next);
  });

  router.get("/requests/:id", requireAdminAccess, (request, response, next) => {
    reservationRequestController.getById(request, response).catch(next);
  });

  router.patch("/requests/:id", requireAdminAccess, (request, response, next) => {
    reservationRequestController.approve(request, response).catch(next);
  });

  return router;
}

module.exports = createAdminRoutes;
