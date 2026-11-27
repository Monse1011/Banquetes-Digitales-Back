const express = require("express");
const UserRole = require("../../domain/enums/auth/user-role");
const requireRole = require("../middleware/auth/role-middleware");

// Función 3.6 - Seguimiento y cierre del evento. Solo el Personal de Logística; que sea el
// responsable asignado de la solicitud lo valida el caso de uso.
function createEventClosureRoutes(eventClosureController, authMiddleware) {
  const router = express.Router();

  router.use(authMiddleware);

  // Horas reales, observaciones y «Finalizar» en una sola operación (RF-2.3.6.1 a RF-2.3.6.3).
  router.patch(
    "/requests/:id/ending",
    requireRole(UserRole.LOGISTICS),
    (request, response, next) => {
      eventClosureController.finalize(request, response).catch(next);
    }
  );

  return router;
}

module.exports = createEventClosureRoutes;
