const express = require("express");
const UserRole = require("../../domain/enums/auth/user-role");
const requireRole = require("../middleware/auth/role-middleware");
const {
  ReservationRequestController,
} = require("../controller/reservation-request/reservation-request-controller");

function createLogisticsRoutes(
  resourceControllers,
  authMiddleware,
  proposalControllers,
  reservationRequestController
) {
  const router = express.Router();
  const assignmentController = resourceControllers.assignment;
  // RF-2.3.2.21: la confirmación de recursos también la puede realizar el Administrador General.
  const requireLogisticsOrAdmin = requireRole(UserRole.LOGISTICS, UserRole.ADMIN);
  const requireLogistics = requireRole(UserRole.LOGISTICS);
  router.use(authMiddleware);

  ["human", "material", "logistic"].forEach((type) => {
    router.get(`/resources/${type}`, requireLogisticsOrAdmin, (request, response, next) => {
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

  router.post("/requests/:id/resources", requireLogisticsOrAdmin, (request, response, next) => {
    assignmentController.assign(request, response).catch(next);
  });

  router.delete(
    "/requests/:id/resources/:resourceId",
    requireLogisticsOrAdmin,
    (request, response, next) => {
      assignmentController.release(request, response).catch(next);
    }
  );

  router.post(
    "/requests/:id/resources/confirm",
    requireLogisticsOrAdmin,
    (request, response, next) => {
      assignmentController.confirm(request, response).catch(next);
    }
  );

  router.post(
    "/requests/:id/resources/cancel",
    requireLogisticsOrAdmin,
    (request, response, next) => {
      assignmentController.cancel(request, response).catch(next);
    }
  );

  // Función 3.1 - Visualización de reservaciones asignadas.
  const reqController = reservationRequestController || new ReservationRequestController({});

  router.get("/requests/history", requireLogistics, (request, response, next) => {
    reqController.listHistoryForLogistics(request, response).catch(next);
  });

  router.get("/requests", requireLogistics, (request, response, next) => {
    reqController.listForLogistics(request, response).catch(next);
  });

  // DAD, Función 3.1: GET /api/logistics/requests/:id es el detalle de la reservación asignada.
  router.get("/requests/:id", requireLogistics, (request, response, next) => {
    reqController.getByIdForLogistics(request, response).catch(next);
  });

  const { agreementsController, proposalController } = proposalControllers || {};

  // Función 3.4 - Contacto con el cliente.
  // Precarga del formulario de acuerdos (RF-2.3.4.1 / RF-2.3.4.2). Antes usaba
  // GET /requests/:id, ruta que el DAD reserva para el detalle de la Función 3.1.
  router.get(
    "/requests/:id/derived-information",
    requireLogisticsOrAdmin,
    (request, response, next) => {
      agreementsController.getRequestAgreements(request, response).catch(next);
    }
  );

  router.post(
    "/requests/:id/derived-information",
    requireLogisticsOrAdmin,
    (request, response, next) => {
      agreementsController.saveAgreements(request, response).catch(next);
    }
  );

  router.post("/requests/:id/proposals", requireLogisticsOrAdmin, (request, response, next) => {
    proposalController.generate(request, response).catch(next);
  });

  router.get("/requests/:id/proposals", requireLogisticsOrAdmin, (request, response, next) => {
    proposalController.get(request, response).catch(next);
  });

  router.get(
    "/requests/:id/proposals/download",
    requireLogisticsOrAdmin,
    (request, response, next) => {
      proposalController.download(request, response).catch(next);
    }
  );

  router.post("/requests/:id/proposals/send", requireLogistics, (request, response, next) => {
    proposalController.send(request, response).catch(next);
  });

  return router;
}

module.exports = createLogisticsRoutes;
