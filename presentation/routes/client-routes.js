const express = require("express");
const createRateLimit = require("../middleware/rate-limit");
const { ClientProposalMessages } = require("../../domain/constants/client-proposal-messages");

// Incremento 3: los endpoints públicos de seguimiento y confirmación operan solo por folio
// y van sujetos a limitación de solicitudes (RF-3.4.5.1, contrato DAD 429).
function createClientRateLimit() {
  return createRateLimit({
    windowMs: 60 * 1000,
    max: Number(process.env.CLIENT_RATE_LIMIT_MAX || 30),
    message: ClientProposalMessages.TOO_MANY_REQUESTS,
  });
}

function createClientRoutes(
  reservationRequestController,
  serviceController,
  clientProposalController = null
) {
  const router = express.Router();

  router.post("/request", (request, response, next) => {
    reservationRequestController.create(request, response).catch(next);
  });

  router.get("/services", (request, response, next) => {
    serviceController.list(request, response).catch(next);
  });

  if (clientProposalController) {
    const rateLimit = createClientRateLimit();
    const call = (method) => (request, response, next) =>
      clientProposalController[method](request, response).catch(next);

    // Función 4.5: seguimiento de solicitud por folio.
    router.get("/requests/:folio", rateLimit, call("track"));
    // Función 4.4: detalle y confirmación de la propuesta vigente.
    router.get("/requests/:folio/proposal", rateLimit, call("proposal"));
    router.post("/requests/:folio/proposal/accept", rateLimit, call("accept"));
    router.post("/requests/:folio/proposal/adjustments", rateLimit, call("adjustments"));
    router.post("/requests/:folio/proposal/reject", rateLimit, call("reject"));
    router.get("/requests/:folio/proposal/pdf", rateLimit, call("pdf"));
  }

  return router;
}

module.exports = createClientRoutes;
module.exports.createClientRateLimit = createClientRateLimit;
