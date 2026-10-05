const { ApproveReservationRequestUseCase } = require("./approve-reservation-request-use-case");
const { GetReservationRequestUseCase } = require("./get-reservation-request-use-case");
const { CreateReservationRequestUseCase } = require("./create-reservation-request-use-case");
const { UpsertClientByEmailUseCase } = require("../client/upsert-client-by-email-use-case");
const {
  InMemoryClientRepository,
} = require("../../../infrastructure/repositories/client/in-memory-client-repository");
const {
  InMemoryServiceRepository,
} = require("../../../infrastructure/repositories/service/in-memory-service-repository");
const {
  InMemoryReservationRequestRepository,
} = require("../../../infrastructure/repositories/reservation-request/in-memory-reservation-request-repository");
const {
  InMemoryFolioGenerator,
} = require("../../../infrastructure/services/reservation-request/in-memory-folio-generator");
const {
  InMemoryUserRepository,
} = require("../../../infrastructure/repositories/auth/in-memory-user-repository");
const { Service } = require("../../../domain/entities/service/service");
const User = require("../../../domain/entities/auth/user");
const UserRole = require("../../../domain/enums/auth/user-role");
const UserStatus = require("../../../domain/enums/auth/user-status");

describe("ReservationRequest Review UseCases", () => {
  let clientRepository;
  let serviceRepository;
  let reservationRequestRepository;
  let userRepository;
  let approveUseCase;
  let getUseCase;
  let createUseCase;

  beforeEach(async () => {
    clientRepository = new InMemoryClientRepository();
    serviceRepository = new InMemoryServiceRepository([
      new Service(1, "Catering", "Servicio de catering", "activo"),
    ]);
    reservationRequestRepository = new InMemoryReservationRequestRepository();
    userRepository = new InMemoryUserRepository([
      new User(
        7,
        "EMP-007",
        "David Torres",
        "david@example.com",
        "$2b$hash",
        UserRole.LOGISTICA,
        UserStatus.ACTIVE,
        new Date(),
        new Date()
      ),
    ]);

    const folioGenerator = new InMemoryFolioGenerator();
    const upsertClientByEmailUseCase = new UpsertClientByEmailUseCase(clientRepository);

    approveUseCase = new ApproveReservationRequestUseCase(reservationRequestRepository);
    getUseCase = new GetReservationRequestUseCase(
      reservationRequestRepository,
      clientRepository,
      serviceRepository,
      userRepository
    );
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

  describe("GetReservationRequestUseCase", () => {
    it("should get a request with full details", async () => {
      const requestId = await createPendingRequest();

      const result = await getUseCase.execute(requestId);

      expect(result.data[0]).toHaveProperty("request_id");
      expect(result.data[0]).toHaveProperty("folio");
      expect(result.data[0]).toHaveProperty("client_name");
      expect(result.data[0]).toHaveProperty("event_end_time");
      expect(result.data[0].logistic_user).toBeNull();
      expect(result.data[0].selected_services).toHaveLength(1);
    });

    it("should show the assigned logistic user in the details (RF-1.2.4.2)", async () => {
      const requestId = await createPendingRequest();
      await approveUseCase.execute(requestId);
      await reservationRequestRepository.assign(requestId, 7, 1);

      const result = await getUseCase.execute(requestId);

      expect(result.data[0].logistic_user).toEqual({
        id: 7,
        full_name: "David Torres",
        email: "david@example.com",
      });
    });
  });
});
