const { createApp } = require('./presentation/app');
const { createPostgresPool } = require('./infrastructure/database/postgres-pool');
const { PostgresClientRepository } = require('./infrastructure/repositories/postgres-client-repository');
const { PostgresServiceRepository } = require('./infrastructure/repositories/postgres-service-repository');
const { PostgresReservationRequestRepository } = require('./infrastructure/repositories/postgres-reservation-request-repository');
const { UpsertClientByEmailUseCase } = require('./application/use-cases/client/upsert-client-by-email-use-case');
const { CreateReservationRequestUseCase } = require('./application/use-cases/reservation-request/create-reservation-request-use-case');
const { ApproveReservationRequestUseCase } = require('./application/use-cases/reservation-request/approve-reservation-request-use-case');
const { GetReservationRequestUseCase } = require('./application/use-cases/reservation-request/get-reservation-request-use-case');
const { GetReservationRequestsUseCase } = require('./application/use-cases/reservation-request/get-reservation-requests-use-case');
const PostgresFolioGenerator = require('./infrastructure/services/postgres-folio-generator');

async function main() {
  const pool = createPostgresPool();

  try {
    await pool.query('SELECT 1');
    console.log('Database connected successfully');
  } catch (error) {
    console.error('Failed to connect to database:', error);
    process.exit(1);
  }

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
    clientRepository,
    serviceRepository,
    reservationRequestRepository,
    folioGenerator,
    upsertClientByEmailUseCase,
    createReservationRequestUseCase,
    approveReservationRequestUseCase,
    getReservationRequestUseCase,
    getReservationRequestsUseCase
  });

  const port = process.env.PORT || 3000;

  app.listen(port, () => {
    console.log(`Server running on port ${port}`);
  });
}

main().catch(error => {
  console.error('Application error:', error);
  process.exit(1);
});
