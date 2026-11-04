const express = require("express");
const UserRole = require("../../domain/enums/auth/user-role");
const requireRole = require("../middleware/auth/role-middleware");

function createAdminRoutes(
  reservationRequestController,
  userController,
  authMiddleware,
  serviceController = null
) {
  const router = express.Router();
  // RF-1.2.4.16: las funciones de la Función 2.4 se restringen a Administrador General.
  router.use(authMiddleware, requireRole(UserRole.ADMIN));

  router.get("/requests", (request, response, next) => {
    reservationRequestController.list(request, response).catch(next);
  });

  router.get("/requests/:id", (request, response, next) => {
    reservationRequestController.getById(request, response).catch(next);
  });

  router.patch("/requests/:id", (request, response, next) => {
    reservationRequestController.approve(request, response).catch(next);
  });

  router.patch("/requests/:id/assignment", (request, response, next) => {
    reservationRequestController.assign(request, response).catch(next);
  });

  router.get("/users/usersavailable", (request, response, next) => {
    userController.available(request, response).catch(next);
  });

  router.get("/users", (request, response, next) => {
    userController.list(request, response).catch(next);
  });

  router.get("/users/:id", (request, response, next) => {
    userController.getById(request, response).catch(next);
  });

  router.post("/users", (request, response, next) => {
    userController.create(request, response).catch(next);
  });

  router.patch("/users/:id", (request, response, next) => {
    userController.update(request, response).catch(next);
  });

  router.post("/users/:id/credentials", (request, response, next) => {
    userController.resendCredentials(request, response).catch(next);
  });

  router.put("/users/:id", (request, response, next) => {
    userController.toggleStatus(request, response).catch(next);
  });

  if (serviceController) {
    router.get("/services", (request, response, next) => {
      serviceController.listAdmin(request, response).catch(next);
    });

    router.post("/services", (request, response, next) => {
      serviceController.create(request, response).catch(next);
    });

    router.patch("/services/:id", (request, response, next) => {
      serviceController.update(request, response).catch(next);
    });

    router.put("/services/:id", (request, response, next) => {
      serviceController.changeStatus(request, response).catch(next);
    });

    router.put("/services/:id/status", (request, response, next) => {
      serviceController.changeStatus(request, response).catch(next);
    });

    router.delete("/services/:id", (request, response, next) => {
      serviceController.delete(request, response).catch(next);
    });
  }

  return router;
}

module.exports = createAdminRoutes;
