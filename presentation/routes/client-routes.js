const express = require("express");

function createClientRoutes(reservationRequestController, serviceController) {
  const router = express.Router();

  router.post("/request", (request, response, next) => {
    reservationRequestController.create(request, response).catch(next);
  });

  router.get("/services", (request, response, next) => {
    serviceController.list(request, response).catch(next);
  });

  return router;
}

module.exports = createClientRoutes;
