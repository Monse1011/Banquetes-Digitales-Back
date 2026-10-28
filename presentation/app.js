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
const CalendarController = require("./controller/calendar/calendar-controller");
const {
  createLogisticsCalendarRoutes,
  createAdminCalendarRoutes,
} = require("./routes/calendar-routes");
const { ResourceController } = require("./controller/resource/resource-controller");
const { HumanResourceController } = require("./controller/resource/human-resource-controller");
const { OperativeRoleController } = require("./controller/resource/operative-role-controller");
const {
  InventoryResourceController,
} = require("./controller/resource/inventory-resource-controller");
const {
  ResourceAssignmentController,
} = require("./controller/resource-assignment/resource-assignment-controller");
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
const OperativeRoleNotFoundException = require("../domain/exceptions/operative-role/operative-role-not-found-exception");
const OperativeRoleValidationException = require("../domain/exceptions/operative-role/operative-role-validation-exception");
const ResourceNotFoundException = require("../domain/exceptions/resource/resource-not-found-exception");
const DuplicateResourceException = require("../domain/exceptions/resource/duplicate-resource-exception");
const ResourceConcurrencyException = require("../domain/exceptions/resource/resource-concurrency-exception");
const ResourceAssignmentValidationException = require("../domain/exceptions/resource-assignment/resource-assignment-validation-exception");
const RequestAccessDeniedException = require("../domain/exceptions/resource-assignment/request-access-denied-exception");
const RequestNotConfirmableException = require("../domain/exceptions/resource-assignment/request-not-confirmable-exception");
const ResourceAvailabilityChangedException = require("../domain/exceptions/resource-assignment/resource-availability-changed-exception");
const UnassignedSufficientResourcesException = require("../domain/exceptions/resource-assignment/unassigned-sufficient-resources-exception");
const ProvisionalAssignmentNotFoundException = require("../domain/exceptions/resource-assignment/provisional-assignment-not-found-exception");
const CalendarValidationException = require("../domain/exceptions/calendar/calendar-validation-exception");
const CalendarEventNotFoundException = require("../domain/exceptions/calendar/calendar-event-not-found-exception");
const CalendarAccessDeniedException = require("../domain/exceptions/calendar/calendar-access-denied-exception");
const EventAvailabilityConflictException = require("../domain/exceptions/calendar/event-availability-conflict-exception");
const EventNotModifiableException = require("../domain/exceptions/calendar/event-not-modifiable-exception");
const RequestNotSchedulableException = require("../domain/exceptions/calendar/request-not-schedulable-exception");
const AgreementsValidationException = require("../domain/exceptions/proposal/agreements-validation-exception");
const RequestNotInAgreementsStateException = require("../domain/exceptions/proposal/request-not-in-agreements-state-exception");
const AgreementsRevisionChangedException = require("../domain/exceptions/proposal/agreements-revision-changed-exception");
const ProposalGenerationNotAllowedException = require("../domain/exceptions/proposal/proposal-generation-not-allowed-exception");
const ProposalAlreadyGeneratedException = require("../domain/exceptions/proposal/proposal-already-generated-exception");
const ProposalNotFoundException = require("../domain/exceptions/proposal/proposal-not-found-exception");
const DerivedInformationNotFoundException = require("../domain/exceptions/proposal/derived-information-not-found-exception");
const ResourceAvailabilityExceededException = require("../domain/exceptions/proposal/resource-availability-exceeded-exception");
const ScheduleConflictException = require("../domain/exceptions/proposal/schedule-conflict-exception");
const ProposalGenerationFailedException = require("../domain/exceptions/proposal/proposal-generation-failed-exception");
const ProposalSendFailedException = require("../domain/exceptions/proposal/proposal-send-failed-exception");
const InvalidIdException = require("../domain/exceptions/common/invalid-id-exception");
const { AgreementsController } = require("./controller/proposal/agreements-controller");
const { ProposalController } = require("./controller/proposal/proposal-controller");
const {
  ClientProposalController,
} = require("./controller/client-proposal/client-proposal-controller");
const InvalidFolioFormatException = require("../domain/exceptions/client-proposal/invalid-folio-format-exception");
const ClientRequestNotFoundException = require("../domain/exceptions/client-proposal/client-request-not-found-exception");
const AcceptedTermsRequiredException = require("../domain/exceptions/client-proposal/accepted-terms-required-exception");
const RejectionConfirmationRequiredException = require("../domain/exceptions/client-proposal/rejection-confirmation-required-exception");
const ObservationsValidationException = require("../domain/exceptions/client-proposal/observations-validation-exception");
const ClientProposalNotAvailableException = require("../domain/exceptions/client-proposal/client-proposal-not-available-exception");
const ProposalActionConflictException = require("../domain/exceptions/client-proposal/proposal-action-conflict-exception");
const ProposalAcceptanceConflictException = require("../domain/exceptions/client-proposal/proposal-acceptance-conflict-exception");
const ProposalAcceptanceFailedException = require("../domain/exceptions/client-proposal/proposal-acceptance-failed-exception");
const ErrorMessages = require("./constants/error-messages");

// Incremento 3 (Funciones 4.4 y 4.5): el folio inválido (400) y el inexistente (404)
// comparten el mensaje del contrato (RF-3.4.5.1.2).
const TRACKING_ENDPOINT_PATH = /^\/api\/client\/requests\/[^/]+\/?$/;

function isTrackingEndpointRequest(request) {
  const url = (request?.originalUrl ?? request?.url ?? "").split("?")[0];

  return TRACKING_ENDPOINT_PATH.test(url);
}

function handleClientProposalError(error, request, response) {
  if (error instanceof InvalidFolioFormatException) {
    response.status(400).json({ message: error.message });
    return true;
  }

  if (error instanceof ClientRequestNotFoundException) {
    if (isTrackingEndpointRequest(request)) {
      response.status(400).json({ error: { message: error.message } });
      return true;
    }

    response.status(404).json({ message: error.message });
    return true;
  }

  if (
    error instanceof AcceptedTermsRequiredException ||
    error instanceof RejectionConfirmationRequiredException ||
    error instanceof ObservationsValidationException
  ) {
    response.status(400).json({ message: error.message });
    return true;
  }

  if (
    error instanceof ClientProposalNotAvailableException ||
    error instanceof ProposalActionConflictException
  ) {
    response.status(409).json({ message: error.message });
    return true;
  }

  if (error instanceof ProposalAcceptanceConflictException) {
    response.status(409).json({ message: error.message });
    return true;
  }

  if (error instanceof ProposalAcceptanceFailedException) {
    response.status(500).json({ message: error.message });
    return true;
  }

  return false;
}

function handleOperativeRoleError(error, response) {
  if (error instanceof OperativeRoleNotFoundException) {
    response.status(404).json({ message: error.message });
    return true;
  }

  if (error instanceof OperativeRoleValidationException) {
    response.status(422).json({ message: error.message, errors: error.errors });
    return true;
  }

  return false;
}

// Funciones 2.8 a 2.10: errores de los recursos.
function handleResourceError(error, response) {
  if (handleOperativeRoleError(error, response)) return true;

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

// Función 3.2: errores de la confirmación de recursos.
function handleResourceAssignmentError(error, response) {
  if (error instanceof ResourceAssignmentValidationException) {
    response.status(422).json({ message: error.message, errors: error.errors });
    return true;
  }

  if (error instanceof RequestAccessDeniedException) {
    response.status(403).json({ message: error.message });
    return true;
  }

  if (
    error instanceof RequestNotConfirmableException ||
    error instanceof ResourceAvailabilityChangedException
  ) {
    response.status(409).json({ message: error.message });
    return true;
  }

  if (error instanceof UnassignedSufficientResourcesException) {
    response.status(400).json({ message: error.message });
    return true;
  }

  if (error instanceof ProvisionalAssignmentNotFoundException) {
    response.status(404).json({ message: error.message });
    return true;
  }

  return false;
}

// Función 3.3: errores del calendario (validación, acceso, conflictos y estados no modificables).
function handleCalendarError(error, response) {
  if (error instanceof CalendarValidationException) {
    response.status(422).json({
      status: "error",
      message: "Error de validación",
      errors: error.errors,
    });
    return true;
  }

  if (error instanceof CalendarEventNotFoundException) {
    response.status(404).json({
      status: "error",
      message: error.message || "Evento no encontrado",
    });
    return true;
  }

  if (error instanceof EventAvailabilityConflictException) {
    response.status(409).json({
      status: "error",
      message: error.message,
      conflicts: error.conflicts,
    });
    return true;
  }

  if (error instanceof CalendarAccessDeniedException) {
    response.status(403).json({
      status: "error",
      message: error.message || "No tiene permisos para realizar esta acción",
    });
    return true;
  }

  if (
    error instanceof EventNotModifiableException ||
    error instanceof RequestNotSchedulableException
  ) {
    response.status(400).json({
      status: "error",
      message: error.message,
    });
    return true;
  }

  return false;
}

// Función 3.4: validaciones y conflictos de acuerdos y propuestas.
function handleProposalConflictError(error, response) {
  if (error instanceof AgreementsRevisionChangedException) {
    response.status(409).json({ message: error.message, code: error.code });
    return true;
  }
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

// Estándares de Código 2.4: los ids inválidos de la URL responden 400.
function handleCommonError(error, response) {
  if (error instanceof InvalidIdException) {
    response.status(400).json({ message: error.message });
    return true;
  }

  return false;
}

// Funciones 2.1 a 2.3: errores de autenticación y recuperación de contraseña.
function handleAuthError(error, response) {
  if (error instanceof AccountBlockedException) {
    response.status(423).json({ message: ErrorMessages.ACCOUNT_BLOCKED });
    return true;
  }

  if (error instanceof InvalidCredentialsException) {
    response.status(401).json({ message: ErrorMessages.INVALID_CREDENTIALS });
    return true;
  }

  if (error instanceof InvalidPasswordException || error instanceof InvalidResetTokenException) {
    response.status(400).json({
      message:
        error instanceof InvalidResetTokenException
          ? ErrorMessages.INVALID_RESET_TOKEN
          : ErrorMessages.INVALID_PASSWORD,
    });
    return true;
  }

  return false;
}

function createResourceControllers(dependencies) {
  return {
    resource: new ResourceController(dependencies.resourceUseCases),
    human: new HumanResourceController(dependencies.humanResourceUseCases),
    operativeRole: new OperativeRoleController(dependencies.operativeRoleUseCases),
    material: new InventoryResourceController(
      dependencies.materialResourceUseCases,
      ResourceType.MATERIAL
    ),
    logistic: new InventoryResourceController(
      dependencies.logisticResourceUseCases,
      ResourceType.LOGISTIC
    ),
    // Función 3.2: confirmación de recursos de una solicitud.
    assignment: new ResourceAssignmentController(dependencies.resourceAssignmentUseCases),
  };
}

function createApp(dependencies) {
  const app = express();

  // Authentication
  const authMiddleware = createAuthMiddleware(dependencies.tokenService);
  const reservationRequestController = new ReservationRequestController(dependencies);
  const userController = new UserController(dependencies);
  const serviceController = new ServiceController(dependencies.serviceRepository);
  const calendarController = new CalendarController(dependencies);
  const resourceControllers = createResourceControllers(dependencies);
  const proposalControllers = {
    agreementsController: new AgreementsController(dependencies),
    proposalController: new ProposalController(dependencies),
  };
  const clientProposalController = new ClientProposalController(dependencies);

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

  app.use(
    "/api/client",
    createClientRoutes(reservationRequestController, serviceController, clientProposalController)
  );
  app.use("/api/admin/resources", createAdminResourceRoutes(resourceControllers, authMiddleware));
  app.use("/api/admin", createAdminCalendarRoutes(calendarController, authMiddleware));
  app.use("/api/logistics", createLogisticsCalendarRoutes(calendarController, authMiddleware));
  app.use(
    "/api/admin",
    createAdminRoutes(reservationRequestController, userController, authMiddleware)
  );
  app.use(
    "/api/logistics",
    createLogisticsRoutes(
      resourceControllers,
      authMiddleware,
      proposalControllers,
      reservationRequestController
    )
  );

  // Error handler
  app.use((error, request, response, _next) => {
    if (handleCommonError(error, response)) return;
    if (handleCalendarError(error, response)) return;
    if (handleResourceError(error, response)) return;
    if (handleResourceAssignmentError(error, response)) return;

    if (error instanceof ReservationRequestValidationException) {
      response.status(422).json({
        message: error.message,
        errors: error.errors,
      });
      return;
    }

    if (handleAssignmentError(error, response)) return;
    if (handleClientProposalError(error, request, response)) return;
    if (handleProposalError(error, response)) return;
    if (handleAuthError(error, response)) return;

    if (error.status) {
      response.status(error.status).json({ message: error.message });
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
