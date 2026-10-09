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
const { UserController } = require("./controller/user/user-controller");
const { ServiceController } = require("./controller/service/service-controller");
const { ResourceController } = require("./controller/resource/resource-controller");
const { HumanResourceController } = require("./controller/resource/human-resource-controller");
const {
  InventoryResourceController,
} = require("./controller/resource/inventory-resource-controller");
const { ResourceType } = require("../domain/enums/resource/resource-type");
const ReservationRequestValidationException = require("../domain/exceptions/reservation-request/reservation-request-validation-exception");
const ReservationRequestNotFoundException = require("../domain/exceptions/reservation-request/reservation-request-not-found-exception");
const RequestNotReassignableException = require("../domain/exceptions/reservation-request/request-not-reassignable-exception");
const RequestAssignmentConflictException = require("../domain/exceptions/reservation-request/request-assignment-conflict-exception");
const LogisticsUserNotAvailableException = require("../domain/exceptions/reservation-request/logistics-user-not-available-exception");
const InvalidCredentialsException = require("../domain/exceptions/auth/invalid-credentials-exception");
const AccountBlockedException = require("../domain/exceptions/auth/account-blocked-exception");
const InvalidPasswordException = require("../domain/exceptions/password-reset/invalid-password-exception");
const InvalidResetTokenException = require("../domain/exceptions/password-reset/invalid-reset-token-exception");
const ResourceValidationException = require("../domain/exceptions/resource/resource-validation-exception");
const ResourceNotFoundException = require("../domain/exceptions/resource/resource-not-found-exception");
const DuplicateResourceException = require("../domain/exceptions/resource/duplicate-resource-exception");
const ResourceConcurrencyException = require("../domain/exceptions/resource/resource-concurrency-exception");
const AgreementsValidationException = require("../domain/exceptions/proposal/agreements-validation-exception");
const RequestNotInAgreementsStateException = require("../domain/exceptions/proposal/request-not-in-agreements-state-exception");
const ProposalGenerationNotAllowedException = require("../domain/exceptions/proposal/proposal-generation-not-allowed-exception");
const ProposalAlreadyGeneratedException = require("../domain/exceptions/proposal/proposal-already-generated-exception");
const ProposalNotFoundException = require("../domain/exceptions/proposal/proposal-not-found-exception");
const DerivedInformationNotFoundException = require("../domain/exceptions/proposal/derived-information-not-found-exception");
const ResourceAvailabilityExceededException = require("../domain/exceptions/proposal/resource-availability-exceeded-exception");
const ScheduleConflictException = require("../domain/exceptions/proposal/schedule-conflict-exception");
const ProposalGenerationFailedException = require("../domain/exceptions/proposal/proposal-generation-failed-exception");
const ProposalSendFailedException = require("../domain/exceptions/proposal/proposal-send-failed-exception");
const { AgreementsController } = require("./controller/proposal/agreements-controller");
const { ProposalController } = require("./controller/proposal/proposal-controller");
const ErrorMessages = require("./constants/error-messages");

// Funciones 2.8 a 2.10: errores de los recursos.
function handleResourceError(error, response) {
  if (error instanceof ResourceValidationException) {
    response.status(422).json({ message: error.message, errors: error.errors });
    return true;
  }

  if (error instanceof ResourceNotFoundException) {
    response.status(404).json({ message: error.message });
    return true;
  }

  if (error instanceof ResourceConcurrencyException) {
    response.status(409).json({ message: error.message });
    return true;
  }

  // RF-1.2.8.7: el cliente reenvía la petición con confirm_duplicate para continuar.
  if (error instanceof DuplicateResourceException) {
    response.status(409).json({ message: error.message, requires_confirmation: true });
    return true;
  }

  return false;
}

// Función 2.4: los mensajes de las excepciones de asignación son los del ERS.
function handleAssignmentError(error, response) {
  if (error instanceof ReservationRequestNotFoundException) {
    response.status(404).json({ message: error.message });
    return true;
  }

  if (
    error instanceof RequestNotReassignableException ||
    error instanceof RequestAssignmentConflictException
  ) {
    response.status(409).json({ message: error.message });
    return true;
  }

  if (error instanceof LogisticsUserNotAvailableException) {
    response.status(409).json({
      message: error.message,
      ...(error.conflict ? { conflict: error.conflict } : {}),
    });
    return true;
  }

  return false;
}

// Función 3.4: validaciones y conflictos de acuerdos y propuestas.
function handleProposalConflictError(error, response) {
  if (error instanceof AgreementsValidationException) {
    response.status(400).json({ message: error.message, errors: error.errors });
    return true;
  }

  if (
    error instanceof ResourceAvailabilityExceededException ||
    error instanceof ScheduleConflictException
  ) {
    response.status(409).json({ message: error.message, conflicts: error.conflicts });
    return true;
  }

  if (
    error instanceof RequestNotInAgreementsStateException ||
    error instanceof ProposalGenerationNotAllowedException ||
    error instanceof ProposalAlreadyGeneratedException
  ) {
    response.status(409).json({ message: error.message });
    return true;
  }

  return false;
}

// Función 3.4: errores de propuestas inexistentes y fallos de generación o envío.
function handleProposalFailureError(error, response) {
  if (
    error instanceof ProposalNotFoundException ||
    error instanceof DerivedInformationNotFoundException
  ) {
    response.status(404).json({ message: error.message });
    return true;
  }

  if (
    error instanceof ProposalGenerationFailedException ||
    error instanceof ProposalSendFailedException
  ) {
    response.status(500).json({ message: error.message });
    return true;
  }

  return false;
}

function handleProposalError(error, response) {
  return (
    handleProposalConflictError(error, response) || handleProposalFailureError(error, response)
  );
}

function createApp(dependencies) {
  const app = express();

  // Authentication
  const authMiddleware = createAuthMiddleware(dependencies.tokenService);
  const reservationRequestController = new ReservationRequestController(dependencies);
  const userController = new UserController(dependencies);
  const serviceController = new ServiceController(dependencies.serviceRepository);
  const resourceControllers = {
    resource: new ResourceController(dependencies.resourceUseCases),
    human: new HumanResourceController(dependencies.humanResourceUseCases),
    material: new InventoryResourceController(
      dependencies.materialResourceUseCases,
      ResourceType.MATERIAL
    ),
    logistic: new InventoryResourceController(
      dependencies.logisticResourceUseCases,
      ResourceType.LOGISTIC
    ),
  };
  const proposalControllers = {
    agreementsController: new AgreementsController(dependencies),
    proposalController: new ProposalController(dependencies),
  };

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
  app.use("/api/admin/resources", createAdminResourceRoutes(resourceControllers, authMiddleware));
  app.use(
    "/api/admin",
    createAdminRoutes(reservationRequestController, userController, authMiddleware)
  );
  app.use(
    "/api/logistics",
    createLogisticsRoutes(resourceControllers, authMiddleware, proposalControllers)
  );

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

    if (handleAssignmentError(error, response)) {
      return;
    }

    if (handleProposalError(error, response)) {
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
