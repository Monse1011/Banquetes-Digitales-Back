require("dotenv").config();

const { createApp } = require("../presentation/app");
const { createPostgresPool } = require("../infrastructure/database/postgres-pool");

const REQUIRED_ENV_VARS = ["JWT_SECRET"];

function validateEnv() {
  const hasDatabaseConfig = Boolean(process.env.DATABASE_URL || process.env.PGHOST);
  const missing = REQUIRED_ENV_VARS.filter((name) => !process.env[name]);

  if (!hasDatabaseConfig) {
    missing.push("DATABASE_URL or PGHOST");
  }

  if (missing.length > 0) {
    console.error(`Missing required environment variables: ${missing.join(", ")}`);
    process.exit(1);
  }
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

// Controllers
const AuthController = require("../presentation/controller/auth/auth-controller");
const PasswordResetController = require("../presentation/controller/password-reset/password-reset-controller");

async function main() {
  validateEnv();

  const pool = createPostgresPool();

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
  const authController = new AuthController(authenticateUser, changePassword, userRepository);

  const passwordResetController = new PasswordResetController(requestPasswordReset, resetPassword);

  const app = createApp({
    // Authentication
    authController,
    passwordResetController,
    tokenService,

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
