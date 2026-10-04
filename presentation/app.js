const express = require("express");
const swaggerUi = require("swagger-ui-express");
const createAuthMiddleware = require("./middleware/auth/auth-middleware");
const createAuthRoutes = require("./routes/auth-routes");
const createClientRoutes = require("./routes/client-routes");
const createAdminRoutes = require("./routes/admin-routes");
const createAdminResourceRoutes = require("./routes/admin-resource-routes");
const createLogisticsRoutes = require("./routes/logistics-routes");
const { openApiDocument } = require("./openapi");
const {
  ReservationRequestController,
} = require("./controller/reservation-request/reservation-request-controller");
const { ServiceController } = require("./controller/service/service-controller");
const { HumanResourceController } = require("./controller/resource/human-resource-controller");
const ReservationRequestValidationException = require("../domain/exceptions/reservation-request/reservation-request-validation-exception");
const InvalidCredentialsException = require("../domain/exceptions/auth/invalid-credentials-exception");
const AccountBlockedException = require("../domain/exceptions/auth/account-blocked-exception");
const InvalidPasswordException = require("../domain/exceptions/password-reset/invalid-password-exception");
const InvalidResetTokenException = require("../domain/exceptions/password-reset/invalid-reset-token-exception");
const ResourceValidationException = require("../domain/exceptions/resource/resource-validation-exception");
const ResourceNotFoundException = require("../domain/exceptions/resource/resource-not-found-exception");
const DuplicateResourceException = require("../domain/exceptions/resource/duplicate-resource-exception");
const ErrorMessages = require("./constants/error-messages");

// Función 2.8: los mensajes de las excepciones de recursos son los del ERS.
function handleResourceError(error, response) {
  if (error instanceof ResourceValidationException) {
    response.status(422).json({ message: error.message, errors: error.errors });
    return true;
  }

  if (error instanceof ResourceNotFoundException) {
    response.status(404).json({ message: error.message });
    return true;
  }

  // RF-1.2.8.7: el cliente reenvía la petición con confirm_duplicate para continuar.
  if (error instanceof DuplicateResourceException) {
    response.status(409).json({ message: error.message, requires_confirmation: true });
    return true;
  }

  return false;
}

function createApp(dependencies) {
  const app = express();

  // Authentication
  const authMiddleware = createAuthMiddleware(dependencies.tokenService);
  const reservationRequestController = new ReservationRequestController(dependencies);
  const serviceController = new ServiceController(dependencies.serviceRepository);
  const humanResourceController = new HumanResourceController(dependencies);

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
  app.use(
    "/api/auth",
    createAuthRoutes(
      dependencies.authController,
      authMiddleware,
      dependencies.passwordResetController
    )
  );

  app.use("/api/client", createClientRoutes(reservationRequestController, serviceController));
  app.use(
    "/api/admin/resources",
    createAdminResourceRoutes(humanResourceController, authMiddleware)
  );
  app.use("/api/admin", createAdminRoutes(reservationRequestController, authMiddleware));
  app.use("/api/logistics", createLogisticsRoutes(humanResourceController, authMiddleware));

  // Error handler
  app.use((error, _request, response, _next) => {
    if (handleResourceError(error, response)) return;

    if (error instanceof ReservationRequestValidationException) {
      response.status(422).json({
        message: error.message,
        errors: error.errors,
      });
      return;
    }
    if (error instanceof AccountBlockedException) {
      response.status(423).json({ message: ErrorMessages.ACCOUNT_BLOCKED });
      return;
    }

    if (error instanceof InvalidCredentialsException) {
      response.status(401).json({ message: ErrorMessages.INVALID_CREDENTIALS });
      return;
    }

    if (error instanceof InvalidPasswordException || error instanceof InvalidResetTokenException) {
      response.status(400).json({
        message:
          error instanceof InvalidResetTokenException
            ? ErrorMessages.INVALID_RESET_TOKEN
            : ErrorMessages.INVALID_PASSWORD,
      });
      return;
    }

    console.error("Unhandled request error:", error);
    response.status(500).json({ message: ErrorMessages.INTERNAL_SERVER_ERROR });
  });

  return app;
}

module.exports = {
  createApp,
};
