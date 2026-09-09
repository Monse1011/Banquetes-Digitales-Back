const { CreateReservationRequestUseCase } = require("./create-reservation-request-use-case");
const { UpsertClientByEmailUseCase } = require("../client/upsert-client-by-email-use-case");
const {
  InMemoryClientRepository,
} = require("../../../infrastructure/repositories/in-memory-client-repository");
const {
  InMemoryReservationRequestRepository,
} = require("../../../infrastructure/repositories/in-memory-reservation-request-repository");
const {
  InMemoryFolioGenerator,
} = require("../../../infrastructure/services/in-memory-folio-generator");

describe("CreateReservationRequestUseCase", () => {
  let useCase;

  beforeEach(() => {
    const clientRepository = new InMemoryClientRepository();
    const reservationRequestRepository = new InMemoryReservationRequestRepository();
    const folioGenerator = new InMemoryFolioGenerator();
    const upsertClientByEmailUseCase = new UpsertClientByEmailUseCase(clientRepository);

    useCase = new CreateReservationRequestUseCase(
      upsertClientByEmailUseCase,
      reservationRequestRepository,
      folioGenerator
    );
  });

  it("should create a reservation request", async () => {
    const result = await useCase.execute({
      client_full_name: "John Doe",
      email: "john@example.com",
      phone: "1234567890",
      event_date_time: new Date().toISOString(),
      guest_count: 100,
      event_address: "123 Main St",
      services_ids: [1, 2],
    });

    expect(result).toHaveProperty("folio");
    expect(result.folio).toMatch(/^BD-\d{4}-\d{5}$/);
  });
});
