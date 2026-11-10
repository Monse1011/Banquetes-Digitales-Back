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

// Los catálogos públicos (contratos 11 y 12) los sirve el ClientContentController de la
// Función 4.1; la gestión de promociones (contratos 6 a 10) es de la Función 2.7 y vive en
// las rutas de administración.
function createClientRoutes(
  reservationRequestController,
  clientContentController,
  clientProposalController = null
) {
  const router = express.Router();

  // Función 4.1: los cuatro listados públicos van con la misma limitación de solicitudes
  // que los endpoints de folio (429 con el mensaje del DAD).
  const contentRateLimit = createClientRateLimit();

  router.post("/request", (request, response, next) => {
    reservationRequestController.create(request, response).catch(next);
  });

  // Contrato 12 (edición): catálogo vigente con nombre, descripción y precio.
  router.get("/services", contentRateLimit, (request, response, next) => {
    clientContentController.services(request, response).catch(next);
  });

  // Contrato 11: promociones vigentes (expira antes de listar).
  router.get("/promotions", contentRateLimit, (request, response, next) => {
    clientContentController.promotions(request, response).catch(next);
  });

  // Diagrama Función 3.4: galería y redes sociales.
  router.get("/gallery", contentRateLimit, (request, response, next) => {
    clientContentController.gallery(request, response).catch(next);
  });

  router.get("/social-links", contentRateLimit, (request, response, next) => {
    clientContentController.socialLinks(request, response).catch(next);
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
