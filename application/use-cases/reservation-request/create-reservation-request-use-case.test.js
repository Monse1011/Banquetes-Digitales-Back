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
const ReservationRequestValidationException = require("../../../domain/exceptions/reservation-request-validation-exception");

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

  it("should throw a validation exception with one error per invalid field", async () => {
    await expect(
      useCase.execute({
        client_full_name: "John123",
        email: "not-an-email",
        phone: "123",
        event_date_time: "2000-01-01T10:00:00.000Z",
        guest_count: 0,
        event_address: "",
        services_ids: [],
      })
    ).rejects.toThrow(ReservationRequestValidationException);
  });

  it("should not persist anything when validation fails", async () => {
    const reservationRequestRepository = new InMemoryReservationRequestRepository();
    const clientRepository = new InMemoryClientRepository();
    const folioGenerator = new InMemoryFolioGenerator();
    const upsertClientByEmailUseCase = new UpsertClientByEmailUseCase(clientRepository);

    const isolatedUseCase = new CreateReservationRequestUseCase(
      upsertClientByEmailUseCase,
      reservationRequestRepository,
      folioGenerator
    );

    await isolatedUseCase
      .execute({
        client_full_name: "",
        email: "",
        phone: "",
        event_date_time: "",
        guest_count: 0,
        event_address: "",
        services_ids: [],
      })
      .catch(() => {});

    const { requests } = await reservationRequestRepository.findAll(
      {},
      { field: "eventDate", direction: "asc" },
      1,
      10
    );

    expect(requests).toHaveLength(0);
  });
});
