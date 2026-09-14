const express = require("express");
const swaggerUi = require("swagger-ui-express");
const createAuthMiddleware = require("../middleware/auth-middleware");
const requireRole = require("../middleware/role-middleware");
const createAuthRoutes = require("../routes/auth-routes");
const createPasswordResetRoutes = require("../routes/password-reset-routes");
const createClientRoutes = require("../routes/client-routes");
const createAdminRoutes = require("../routes/admin-routes");
const UserRole = require("../domain/enums/user-role");

const { ReservationRequestController } = require("./controller/reservation-request-controller");
const { ServiceController } = require("./controller/service-controller");
const { openApiDocument } = require("./openapi");
const ReservationRequestValidationException = require("../domain/exceptions/reservation-request-validation-exception");
const InvalidCredentialsException = require("../domain/exceptions/invalid-credentials-exception");
const AccountBlockedException = require("../domain/exceptions/account-blocked-exception");
const InvalidPasswordException = require("../domain/exceptions/invalid-password-exception");
const InvalidResetTokenException = require("../domain/exceptions/invalid-reset-token-exception");

function createApp(dependencies) {
  const app = express();

  const reservationRequestController = new ReservationRequestController(dependencies);
  const serviceController = new ServiceController(dependencies.serviceRepository);

  // Authentication
  const authMiddleware = createAuthMiddleware(dependencies.tokenService);
  const requireAdmin = [authMiddleware, requireRole(UserRole.ADMIN)];

  app.use(express.json());

  app.use((request, _response, next) => {
    console.log(`${new Date().toISOString()} ${request.method} ${request.originalUrl}`);
    next();
  });

  // Documentation
  app.get("/api-docs.json", (_request, response) => {
    response.json(openApiDocument);
  });

  app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(openApiDocument));

  // Authentication routes
  app.use("/api/auth", createAuthRoutes(dependencies.authController, authMiddleware));

  app.use("/api/auth", createPasswordResetRoutes(dependencies.passwordResetController));

  // Client routes
  app.use("/api/client", createClientRoutes(reservationRequestController, serviceController));

  // Admin routes
  app.use("/api/admin", createAdminRoutes(reservationRequestController, requireAdmin));

  // Error handler
  app.use((error, _request, response, _next) => {
    if (error instanceof ReservationRequestValidationException) {
      response.status(422).json({ errors: error.errors });
      return;
    }

    if (error instanceof AccountBlockedException) {
      response.status(423).json({ message: error.message });
      return;
    }

    if (error instanceof InvalidCredentialsException) {
      response.status(401).json({ message: error.message });
      return;
    }

    if (error instanceof InvalidPasswordException || error instanceof InvalidResetTokenException) {
      response.status(400).json({ message: error.message });
      return;
    }

    const message = error instanceof Error ? error.message : "Internal server error";
    const status = message === "Reservation request not found" ? 404 : 400;

    console.error("Unhandled request error:", error);
    response.status(status).json({ message });
  });

  return app;
}

module.exports = {
  createApp,
};
