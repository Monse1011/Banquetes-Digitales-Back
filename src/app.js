/* eslint-disable max-lines-per-function, max-len */
require("dotenv").config();

const { createApp } = require("../presentation/app");
const { createPostgresPool } = require("../infrastructure/database/postgres-pool");

const {
  PostgresClientRepository,
} = require("../infrastructure/repositories/client/postgres-client-repository");
const {
  PostgresServiceRepository,
} = require("../infrastructure/repositories/service/postgres-service-repository");
const {
  PostgresReservationRequestRepository,
} = require("../infrastructure/repositories/reservation-request/postgres-reservation-request-repository");
const PostgresFolioGenerator = require("../infrastructure/services/reservation-request/postgres-folio-generator");
const {
  PostgresResourceRepository,
} = require("../infrastructure/repositories/resource/postgres-resource-repository");
const {
  PostgresOperativeRoleRepository,
} = require("../infrastructure/repositories/operative-role/postgres-operative-role-repository");
const {
  PostgresResourceAssignmentRepository,
} = require("../infrastructure/repositories/resource-assignment/postgres-resource-assignment-repository");
const {
  PostgresResourceConfirmationRepository,
} = require("../infrastructure/repositories/resource-assignment/postgres-resource-confirmation-repository");
const {
  PostgresTransactionManager,
} = require("../infrastructure/services/transaction/postgres-transaction-manager");
const {
  ConfirmedResourceAdapter,
} = require("../infrastructure/repositories/proposal/confirmed-resource-adapter");
const {
  PostgresDerivedInformationRepository,
} = require("../infrastructure/repositories/proposal/postgres-derived-information-repository");
const {
  PostgresProposalRepository,
} = require("../infrastructure/repositories/proposal/postgres-proposal-repository");
const {
  PostgresAuditLogRepository,
} = require("../infrastructure/repositories/proposal/postgres-audit-log-repository");
const { PdfkitPdfGenerator } = require("../infrastructure/services/proposal/pdfkit-pdf-generator");

const REQUIRED_ENV_VARS = [
  "JWT_SECRET",
  "SMTP_HOST",
  "SMTP_PORT",
  "SMTP_USER",
  "SMTP_PASSWORD",
  "RESET_PASSWORD_URL",
];

function getInvalidEnvironmentValues(port, smtpPort, resetPasswordUrl) {
  const invalid = [];

  if (!Number.isInteger(port) || port < 1 || port > 65535) invalid.push("PORT");
  if (!Number.isInteger(smtpPort) || smtpPort < 1 || smtpPort > 65535) invalid.push("SMTP_PORT");

  try {
    const parsedUrl = new URL(resetPasswordUrl);
    if (!parsedUrl.protocol || !parsedUrl.hostname) invalid.push("RESET_PASSWORD_URL");
  } catch {
    invalid.push("RESET_PASSWORD_URL");
  }

  return invalid;
}

function loadConfig() {
  const hasDatabaseConfig = Boolean(process.env.DATABASE_URL || process.env.PGHOST);
  const missing = REQUIRED_ENV_VARS.filter((name) => !process.env[name]);
  const port = Number(process.env.PORT || 3000);
  const smtpPort = Number(process.env.SMTP_PORT);
  const resetPasswordUrl = process.env.RESET_PASSWORD_URL;
  const invalid = getInvalidEnvironmentValues(port, smtpPort, resetPasswordUrl);

  if (!hasDatabaseConfig) {
    missing.push("DATABASE_URL or PGHOST");
  }

  if (missing.length > 0 || invalid.length > 0) {
    if (missing.length > 0) console.error(`Missing environment variables: ${missing.join(", ")}`);
    if (invalid.length > 0) console.error(`Invalid environment variables: ${invalid.join(", ")}`);
    throw new Error("Invalid environment configuration");
  }

  console.log(`Environment loaded for port ${port} with SMTP host ${process.env.SMTP_HOST}`);

  return {
    port,
    database: {
      url: process.env.DATABASE_URL,
      host: process.env.PGHOST,
      port: process.env.PGPORT,
      user: process.env.PGUSER,
      password: process.env.PGPASSWORD,
      database: process.env.PGDATABASE,
    },
    jwt: {
      secret: process.env.JWT_SECRET,
      expiresIn: process.env.JWT_EXPIRES_IN,
    },
    email: {
      host: process.env.SMTP_HOST,
      port: smtpPort,
      user: process.env.SMTP_USER,
      password: process.env.SMTP_PASSWORD,
      resetPasswordUrl: process.env.RESET_PASSWORD_URL,
    },
    authCookie: { secure: process.env.NODE_ENV === "production" },
    proposalStorage: {
      storageDir: process.env.PROPOSAL_STORAGE_DIR || "storage/proposals",
    },
  };
}

// Authentication repositories
const PostgresUserRepository = require("../infrastructure/repositories/auth/postgres-user-repository");
const PostgresBlockRepository = require("../infrastructure/repositories/auth/postgres-block-repository");
const PostgresPasswordResetRepository = require("../infrastructure/repositories/password-reset/postgres-password-reset-repository");

const JwtTokenService = require("../infrastructure/security/jwt-token-service");
const NodemailerEmailService = require("../infrastructure/email/nodemailer-email-service");

// Authentication use cases
const createUserManagementUseCases = require("./create-user-management-use-cases");
const AuthenticateUser = require("../application/use-cases/auth/authenticate-user");
const BlockService = require("../application/use-cases/auth/block-service");
const ChangePassword = require("../application/use-cases/auth/change-password");
const RequestPasswordReset = require("../application/use-cases/password-reset/request-password-reset");
const ResetPassword = require("../application/use-cases/password-reset/reset-password");
const {
  UpsertClientByEmailUseCase,
} = require("../application/use-cases/client/upsert-client-by-email-use-case");
const {
  CreateReservationRequestUseCase,
} = require("../application/use-cases/reservation-request/create-reservation-request-use-case");
const {
  ApproveReservationRequestUseCase,
} = require("../application/use-cases/reservation-request/approve-reservation-request-use-case");
const {
  GetReservationRequestUseCase,
} = require("../application/use-cases/reservation-request/get-reservation-request-use-case");
const {
  GetReservationRequestsUseCase,
} = require("../application/use-cases/reservation-request/get-reservation-requests-use-case");
const {
  AssignReservationRequestUseCase,
} = require("../application/use-cases/reservation-request/assign-reservation-request-use-case");
const {
  GetAvailableLogisticsUsersUseCase,
} = require("../application/use-cases/reservation-request/get-available-logistics-users-use-case");

// Calendar Use Cases (Función 3.3)
const {
  ScheduleEventUseCase,
} = require("../application/use-cases/calendar/schedule-event-use-case");
const { EditEventUseCase } = require("../application/use-cases/calendar/edit-event-use-case");
const { CancelEventUseCase } = require("../application/use-cases/calendar/cancel-event-use-case");
const {
  ListCalendarEventsUseCase,
} = require("../application/use-cases/calendar/list-calendar-events-use-case");
const {
  ProcessPendingCalendarSyncUseCase,
} = require("../application/use-cases/calendar/process-pending-calendar-sync-use-case");
const {
  FinalizeElapsedEventsUseCase,
} = require("../application/use-cases/calendar/finalize-elapsed-events-use-case");
const {
  PostgresCalendarEventRepository,
} = require("../infrastructure/repositories/calendar/postgres-calendar-event-repository");
const {
  PostgresCalendarSyncRepository,
} = require("../infrastructure/repositories/calendar/postgres-calendar-sync-repository");
const {
  RetryCalendarSyncUseCase,
} = require("../application/use-cases/calendar/retry-calendar-sync-use-case");
const GoogleCalendarGateway = require("../infrastructure/services/calendar/google-calendar-gateway");
// Resources use cases (Funciones 2.8 a 2.10)
const {
  createResourceUseCases,
} = require("../application/use-cases/resource/create-resource-use-cases");
const {
  createResourceAssignmentUseCases,
} = require("../application/use-cases/resource-assignment/create-resource-assignment-use-cases");

// Proposal use cases (Función 3.4)
const {
  GetRequestAgreementsUseCase,
} = require("../application/use-cases/proposal/get-request-agreements-use-case");
const {
  SaveAgreementsUseCase,
} = require("../application/use-cases/proposal/save-agreements-use-case");
const {
  GenerateProposalUseCase,
} = require("../application/use-cases/proposal/generate-proposal-use-case");
const { GetProposalUseCase } = require("../application/use-cases/proposal/get-proposal-use-case");
const {
  DownloadProposalUseCase,
} = require("../application/use-cases/proposal/download-proposal-use-case");
const { SendProposalUseCase } = require("../application/use-cases/proposal/send-proposal-use-case");

// Incremento 3 - Funciones 4.4 y 4.5: casos de uso de cliente y adaptadores.
const {
  GetClientRequestTrackingUseCase,
} = require("../application/use-cases/client-proposal/get-client-request-tracking-use-case");
const {
  GetClientProposalDetailUseCase,
} = require("../application/use-cases/client-proposal/get-client-proposal-detail-use-case");
const {
  AcceptProposalUseCase,
} = require("../application/use-cases/client-proposal/accept-proposal-use-case");
const {
  RequestProposalAdjustmentsUseCase,
} = require("../application/use-cases/client-proposal/request-proposal-adjustments-use-case");
const {
  RejectProposalUseCase,
} = require("../application/use-cases/client-proposal/reject-proposal-use-case");
const {
  GetClientProposalPdfUseCase,
} = require("../application/use-cases/client-proposal/get-client-proposal-pdf-use-case");
const {
  PostgresProposalAdjustmentRepository,
} = require("../infrastructure/repositories/client-proposal/postgres-proposal-adjustment-repository");
const {
  PostgresProposalAcceptanceScheduler,
} = require("../infrastructure/services/proposal/postgres-proposal-acceptance-scheduler");

// Controllers
const AuthController = require("../presentation/controller/auth/auth-controller");
const PasswordResetController = require("../presentation/controller/password-reset/password-reset-controller");

// Funciones 2.8 a 2.10 (recursos) y 3.2 (confirmación de recursos). Los datos de asignación y
// confirmación se persisten en PostgreSQL con la migración assigned-resources.sql.
function createResourceDependencies(pool, reservationRequestRepository, userRepository) {
  const resourceRepository = new PostgresResourceRepository(pool);
  const operativeRoleRepository = new PostgresOperativeRoleRepository(pool);
  const assignmentRepository = new PostgresResourceAssignmentRepository(pool);
  const resourceConfirmationRepository = new PostgresResourceConfirmationRepository(pool);

  return {
    resourceConfirmationRepository,
    assignedResourceRepository: new ConfirmedResourceAdapter(
      assignmentRepository,
      resourceRepository
    ),
    ...createResourceUseCases(resourceRepository, operativeRoleRepository),
    ...createResourceAssignmentUseCases(
      resourceRepository,
      reservationRequestRepository,
      assignmentRepository,
      resourceConfirmationRepository,
      operativeRoleRepository,
      userRepository,
      new PostgresTransactionManager(pool)
    ),
  };
}

async function main() {
  const config = loadConfig();

  const pool = createPostgresPool(config.database);

  try {
    await pool.query("SELECT 1");
    console.log("Database connected successfully");
  } catch (error) {
    console.error("Failed to connect to database:", error);
    process.exit(1);
  }

  // Authentication repositories
  const userRepository = new PostgresUserRepository(pool);
  const blockRepository = new PostgresBlockRepository(pool);
  const passwordResetRepository = new PostgresPasswordResetRepository(pool);

  // Authentication services
  const tokenService = new JwtTokenService(config.jwt);
  const emailService = new NodemailerEmailService(config.email);
  const blockService = new BlockService(blockRepository);

  // Authentication use cases
  const authenticateUser = new AuthenticateUser(userRepository, blockService, tokenService);

  const changePassword = new ChangePassword(userRepository, blockService, tokenService);

  const requestPasswordReset = new RequestPasswordReset(
    userRepository,
    passwordResetRepository,
    emailService
  );

  const resetPassword = new ResetPassword(userRepository, passwordResetRepository, tokenService);

  // Authentication controllers
  const authController = new AuthController(
    authenticateUser,
    changePassword,
    userRepository,
    config.authCookie
  );

  const passwordResetController = new PasswordResetController(requestPasswordReset, resetPassword);

  const clientRepository = new PostgresClientRepository(pool);
  const serviceRepository = new PostgresServiceRepository(pool);
  const reservationRequestRepository = new PostgresReservationRequestRepository(pool);
  const folioGenerator = new PostgresFolioGenerator(pool);
  const upsertClientByEmailUseCase = new UpsertClientByEmailUseCase(clientRepository);
  const createReservationRequestUseCase = new CreateReservationRequestUseCase(
    upsertClientByEmailUseCase,
    reservationRequestRepository,
    folioGenerator
  );
  const approveReservationRequestUseCase = new ApproveReservationRequestUseCase(
    reservationRequestRepository
  );
  const getReservationRequestUseCase = new GetReservationRequestUseCase(
    reservationRequestRepository,
    clientRepository,
    serviceRepository,
    userRepository
  );
  const getReservationRequestsUseCase = new GetReservationRequestsUseCase(
    reservationRequestRepository,
    clientRepository,
    serviceRepository,
    userRepository
  );
  const assignReservationRequestUseCase = new AssignReservationRequestUseCase(
    reservationRequestRepository,
    userRepository
  );

  // Función 3.4 - Contacto con el cliente.
  const resourceDependencies = createResourceDependencies(
    pool,
    reservationRequestRepository,
    userRepository
  );
  const { assignedResourceRepository, resourceConfirmationRepository } = resourceDependencies;
  const derivedInformationRepository = new PostgresDerivedInformationRepository(pool);
  const proposalRepository = new PostgresProposalRepository(pool);
  const auditLogRepository = new PostgresAuditLogRepository(pool);
  const pdfGenerator = new PdfkitPdfGenerator(config.proposalStorage);

  const getRequestAgreementsUseCase = new GetRequestAgreementsUseCase(
    reservationRequestRepository,
    clientRepository,
    assignedResourceRepository,
    derivedInformationRepository,
    resourceConfirmationRepository,
    new PostgresTransactionManager(pool)
  );
  const saveAgreementsUseCase = new SaveAgreementsUseCase(
    reservationRequestRepository,
    assignedResourceRepository,
    derivedInformationRepository,
    new PostgresTransactionManager(pool)
  );
  const generateProposalUseCase = new GenerateProposalUseCase(
    reservationRequestRepository,
    clientRepository,
    derivedInformationRepository,
    proposalRepository,
    assignedResourceRepository,
    pdfGenerator,
    new PostgresTransactionManager(pool)
  );
  const getProposalUseCase = new GetProposalUseCase(
    reservationRequestRepository,
    proposalRepository
  );
  const downloadProposalUseCase = new DownloadProposalUseCase(
    reservationRequestRepository,
    proposalRepository,
    pdfGenerator
  );
  const sendProposalUseCase = new SendProposalUseCase(
    reservationRequestRepository,
    clientRepository,
    proposalRepository,
    pdfGenerator,
    emailService,
    auditLogRepository
  );

  // Calendar (necesario para la aceptación de la propuesta, Función 4.4).
  const calendarEventRepository = new PostgresCalendarEventRepository(pool);
  const calendarSyncRepository = new PostgresCalendarSyncRepository(pool);
  const externalCalendarGateway = new GoogleCalendarGateway();
  const processPendingCalendarSyncUseCase = new ProcessPendingCalendarSyncUseCase(
    calendarEventRepository,
    calendarSyncRepository,
    externalCalendarGateway
  );
  const acceptanceScheduler = new PostgresProposalAcceptanceScheduler(
    calendarEventRepository,
    processPendingCalendarSyncUseCase
  );

  // Incremento 3 - Funciones 4.4 y 4.5: seguimiento por folio y confirmación de evento.
  const proposalAdjustmentRepository = new PostgresProposalAdjustmentRepository(pool);
  const clientTransactionManager = new PostgresTransactionManager(pool);
  const getClientRequestTrackingUseCase = new GetClientRequestTrackingUseCase(
    reservationRequestRepository,
    clientRepository,
    derivedInformationRepository
  );
  const getClientProposalDetailUseCase = new GetClientProposalDetailUseCase(
    reservationRequestRepository,
    clientRepository,
    derivedInformationRepository,
    proposalRepository,
    clientTransactionManager
  );
  const acceptProposalUseCase = new AcceptProposalUseCase(
    reservationRequestRepository,
    clientRepository,
    derivedInformationRepository,
    proposalRepository,
    pdfGenerator,
    acceptanceScheduler,
    clientTransactionManager
  );
  const requestProposalAdjustmentsUseCase = new RequestProposalAdjustmentsUseCase(
    reservationRequestRepository,
    proposalRepository,
    proposalAdjustmentRepository,
    clientTransactionManager
  );
  const rejectProposalUseCase = new RejectProposalUseCase(
    reservationRequestRepository,
    proposalRepository,
    assignedResourceRepository,
    clientTransactionManager
  );
  const getClientProposalPdfUseCase = new GetClientProposalPdfUseCase(
    reservationRequestRepository,
    proposalRepository,
    pdfGenerator
  );

  const scheduleEventUseCase = new ScheduleEventUseCase(
    reservationRequestRepository,
    clientRepository,
    calendarEventRepository,
    processPendingCalendarSyncUseCase
  );
  const editEventUseCase = new EditEventUseCase(
    calendarEventRepository,
    processPendingCalendarSyncUseCase
  );
  const cancelEventUseCase = new CancelEventUseCase(
    calendarEventRepository,
    processPendingCalendarSyncUseCase
  );
  const retryCalendarSyncUseCase = new RetryCalendarSyncUseCase(
    calendarEventRepository,
    calendarSyncRepository,
    processPendingCalendarSyncUseCase
  );
  const listCalendarEventsUseCase = new ListCalendarEventsUseCase(calendarEventRepository);
  const finalizeElapsedEventsUseCase = new FinalizeElapsedEventsUseCase(calendarEventRepository);

  const app = createApp({
    // Authentication
    authController,
    passwordResetController,
    tokenService,
    clientRepository,
    serviceRepository,
    reservationRequestRepository,
    folioGenerator,
    upsertClientByEmailUseCase,
    createReservationRequestUseCase,
    approveReservationRequestUseCase,
    getReservationRequestUseCase,
    getReservationRequestsUseCase,
    assignReservationRequestUseCase,
    getAvailableLogisticsUsersUseCase: new GetAvailableLogisticsUsersUseCase(userRepository),
    // Calendar
    scheduleEventUseCase,
    editEventUseCase,
    cancelEventUseCase,
    listCalendarEventsUseCase,
    retryCalendarSyncUseCase,
    // User management (Función 2.12)
    ...createUserManagementUseCases({ pool, emailService }),
    // Resources
    ...resourceDependencies,
    // Proposals (Función 3.4)
    getRequestAgreementsUseCase,
    saveAgreementsUseCase,
    generateProposalUseCase,
    getProposalUseCase,
    downloadProposalUseCase,
    sendProposalUseCase,
    // Incremento 3 - Funciones 4.4 y 4.5
    proposalAdjustmentRepository,
    getClientRequestTrackingUseCase,
    getClientProposalDetailUseCase,
    acceptProposalUseCase,
    requestProposalAdjustmentsUseCase,
    rejectProposalUseCase,
    getClientProposalPdfUseCase,
  });

  // Start background jobs for calendar sync and finalization
  setInterval(() => {
    processPendingCalendarSyncUseCase.execute().catch((err) => console.error("Sync error:", err));
  }, 15000); // every 15 seconds

  setInterval(() => {
    finalizeElapsedEventsUseCase.execute().catch((err) => console.error("Finalize error:", err));
  }, 60000); // every minute

  app.listen(config.port, () => {
    console.log(`Server running on port ${config.port}`);
  });
}

main().catch((error) => {
  console.error("Application error:", error);
  process.exit(1);
});
