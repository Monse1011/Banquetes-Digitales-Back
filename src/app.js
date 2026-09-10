const { createApp } = require("../presentation/app");
const { createPostgresPool } = require("../infrastructure/database/postgres-pool");

// Repositories
const {
  PostgresClientRepository,
} = require("../infrastructure/repositories/postgres-client-repository");
const {
  PostgresServiceRepository,
} = require("../infrastructure/repositories/postgres-service-repository");
const {
  PostgresReservationRequestRepository,
} = require("../infrastructure/repositories/postgres-reservation-request-repository");

// Authentication repositories
const PostgresUserRepository = require("../infrastructure/repositories/postgres-user-repository");
const PostgresBlockRepository = require("../infrastructure/repositories/postgres-block-repository");
const PostgresPasswordResetRepository = require("../infrastructure/repositories/postgres-password-reset-repository");

// Services
const PostgresFolioGenerator = require("../infrastructure/services/postgres-folio-generator");
const JwtTokenService = require("../infrastructure/security/jwt-token-service");
const NodemailerEmailService = require("../infrastructure/email/nodemailer-email-service");

// Use cases
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

// Authentication use cases
const AuthenticateUser = require("../application/use-cases/authenticate-user");
const BlockService = require("../application/use-cases/block-service");
const ChangePassword = require("../application/use-cases/change-password");
const RequestPasswordReset = require("../application/use-cases/request-password-reset");
const ResetPassword = require("../application/use-cases/reset-password");

// Controllers
const AuthController = require("../presentation/controller/auth-controller");
const PasswordResetController = require("../presentation/controller/password-reset-controller");

async function main() {
  const pool = createPostgresPool();

  try {
    await pool.query("SELECT 1");
    console.log("Database connected successfully");
  } catch (error) {
    console.error("Failed to connect to database:", error);
    process.exit(1);
  }

  // Business repositories
  const clientRepository = new PostgresClientRepository(pool);
  const serviceRepository = new PostgresServiceRepository(pool);
  const reservationRequestRepository = new PostgresReservationRequestRepository(pool);
  const folioGenerator = new PostgresFolioGenerator(pool);

  // Authentication repositories
  const userRepository = new PostgresUserRepository(pool);
  const blockRepository = new PostgresBlockRepository(pool);
  const passwordResetRepository = new PostgresPasswordResetRepository(pool);

  // Authentication services
  const tokenService = new JwtTokenService();
  const emailService = new NodemailerEmailService();
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
  const authController = new AuthController(authenticateUser, changePassword);

  const passwordResetController = new PasswordResetController(requestPasswordReset, resetPassword);

  // Business use cases
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

    // Business
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

  const port = process.env.PORT || 3000;

  app.listen(port, () => {
    console.log(`Server running on port ${port}`);
  });
}

main().catch((error) => {
  console.error("Application error:", error);
  process.exit(1);
});
