const { ApproveReservationRequestUseCase } = require("./approve-reservation-request-use-case");
const { CreateReservationRequestUseCase } = require("./create-reservation-request-use-case");
const { UpsertClientByEmailUseCase } = require("../client/upsert-client-by-email-use-case");
const {
  InMemoryClientRepository,
} = require("../../../infrastructure/repositories/client/in-memory-client-repository");
const {
  InMemoryReservationRequestRepository,
} = require("../../../infrastructure/repositories/reservation-request/in-memory-reservation-request-repository");
const {
  InMemoryFolioGenerator,
} = require("../../../infrastructure/services/reservation-request/in-memory-folio-generator");

describe("ReservationRequest Review UseCases", () => {
  let clientRepository;
  let reservationRequestRepository;
  let approveUseCase;
  let createUseCase;

  beforeEach(async () => {
    clientRepository = new InMemoryClientRepository();
    reservationRequestRepository = new InMemoryReservationRequestRepository();
    const folioGenerator = new InMemoryFolioGenerator();
    const upsertClientByEmailUseCase = new UpsertClientByEmailUseCase(clientRepository);

    approveUseCase = new ApproveReservationRequestUseCase(reservationRequestRepository);
    createUseCase = new CreateReservationRequestUseCase(
      upsertClientByEmailUseCase,
      reservationRequestRepository,
      folioGenerator
    );
  });

  async function createPendingRequest() {
    await createUseCase.execute({
      client_full_name: "John Doe",
      email: "john@example.com",
      phone: "1234567890",
      event_date_time: new Date().toISOString(),
      event_end_time: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(),
      guest_count: 100,
      event_address: "123 Main St",
      services_ids: [1],
    });

    const firstRequest = await reservationRequestRepository.findAll(
      {},
      { field: "eventDate", direction: "asc" },
      1,
      1
    );

    return firstRequest.requests[0].requestId;
  }

  describe("ApproveReservationRequestUseCase", () => {
    it("should approve a pending request", async () => {
      const requestId = await createPendingRequest();

      const result = await approveUseCase.execute(requestId);

      expect(result.data[0].status).toBe("Aprobada");
    });

    it("should throw error when request not found", async () => {
      try {
        await approveUseCase.execute(999);
        expect.fail("Should have thrown");
      } catch (error) {
        expect(error.message).toBe("Reservation request not found");
      }
    });
  });
});
