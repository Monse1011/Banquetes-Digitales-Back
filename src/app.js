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
  };
}

// Authentication repositories
const PostgresUserRepository = require("../infrastructure/repositories/auth/postgres-user-repository");
const PostgresBlockRepository = require("../infrastructure/repositories/auth/postgres-block-repository");
const PostgresPasswordResetRepository = require("../infrastructure/repositories/password-reset/postgres-password-reset-repository");

const JwtTokenService = require("../infrastructure/security/jwt-token-service");
const NodemailerEmailService = require("../infrastructure/email/nodemailer-email-service");

// Authentication use cases
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

// Controllers
const AuthController = require("../presentation/controller/auth/auth-controller");
const PasswordResetController = require("../presentation/controller/password-reset/password-reset-controller");

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
    serviceRepository
  );
  const getReservationRequestsUseCase = new GetReservationRequestsUseCase(
    reservationRequestRepository,
    clientRepository,
    serviceRepository
  );

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
  });

  app.listen(config.port, () => {
    console.log(`Server running on port ${config.port}`);
  });
}

main().catch((error) => {
  console.error("Application error:", error);
  process.exit(1);
});
