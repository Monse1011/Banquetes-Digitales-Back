const { AssignReservationRequestUseCase } = require("./assign-reservation-request-use-case");
const { GetAvailableLogisticsUsersUseCase } = require("./get-available-logistics-users-use-case");
const {
  InMemoryReservationRequestRepository,
} = require("../../../infrastructure/repositories/reservation-request/in-memory-reservation-request-repository");
const {
  InMemoryUserRepository,
} = require("../../../infrastructure/repositories/auth/in-memory-user-repository");
const {
  ReservationRequest,
} = require("../../../domain/entities/reservation-request/reservation-request");
const {
  ReservationRequestStatus,
} = require("../../../domain/enums/reservation-request/request-status");
const User = require("../../../domain/entities/auth/user");
const UserRole = require("../../../domain/enums/auth/user-role");
const UserStatus = require("../../../domain/enums/auth/user-status");
const RequestNotReassignableException = require("../../../domain/exceptions/reservation-request/request-not-reassignable-exception");
const RequestAssignmentConflictException = require("../../../domain/exceptions/reservation-request/request-assignment-conflict-exception");
const LogisticsUserNotAvailableException = require("../../../domain/exceptions/reservation-request/logistics-user-not-available-exception");
const ReservationRequestNotFoundException = require("../../../domain/exceptions/reservation-request/reservation-request-not-found-exception");

const LOGISTICS_USER = new User(
  7,
  "EMP-007",
  "David Torres",
  "david@example.com",
  "$2b$hash",
  UserRole.LOGISTICA,
  UserStatus.ACTIVE,
  new Date(),
  new Date()
);

function buildUser(overrides = {}) {
  return new User(
    overrides.id ?? 8,
    overrides.employeeId ?? "EMP-008",
    overrides.fullName ?? "Cesar Huerta",
    overrides.email ?? "cesar@example.com",
    "$2b$hash",
    overrides.role ?? UserRole.LOGISTICA,
    overrides.status ?? UserStatus.ACTIVE,
    new Date(),
    new Date()
  );
}

function buildRequest(overrides = {}) {
  return new ReservationRequest(
    overrides.requestId,
    overrides.folio ?? "BD-2027-00001",
    1,
    null,
    overrides.eventDateTime ?? new Date("2027-05-10T10:00:00"),
    overrides.eventEndTime ?? new Date("2027-05-10T12:00:00"),
    50,
    "123 Main St",
    overrides.status ?? ReservationRequestStatus.APPROVED,
    new Date(),
    [1],
    overrides.logisticUserId ?? null
  );
}

describe("AssignReservationRequestUseCase", () => {
  let reservationRequestRepository;
  let userRepository;
  let useCase;

  beforeEach(() => {
    reservationRequestRepository = new InMemoryReservationRequestRepository();
    userRepository = new InMemoryUserRepository([LOGISTICS_USER, buildUser()]);
    useCase = new AssignReservationRequestUseCase(reservationRequestRepository, userRepository);
  });

  it("assigns an approved request to an active logistics user (RF-1.2.4.3)", async () => {
    const created = await reservationRequestRepository.create(buildRequest());

    await useCase.execute(created.requestId, 7, 1);

    expect(created.status).toBe(ReservationRequestStatus.ASSIGNED);
    expect(created.logisticUserId).toBe(7);
    expect(created.assignedByUserId).toBe(1);
    expect(created.assignedAt).toBeInstanceOf(Date);
  });

  it("reassigns a request in Asignada state to another available user", async () => {
    const created = await reservationRequestRepository.create(buildRequest());
    await useCase.execute(created.requestId, 7, 1);

    await useCase.execute(created.requestId, 8, 1, 7);

    expect(created.status).toBe(ReservationRequestStatus.ASSIGNED);
    expect(created.logisticUserId).toBe(8);
    expect(created.assignedByUserId).toBe(1);
  });

  it("accepts requests that have not started the resource confirmation", async () => {
    const pending = await reservationRequestRepository.create(
      buildRequest({ status: ReservationRequestStatus.PENDING })
    );

    await useCase.execute(pending.requestId, 7, 1);

    expect(pending.logisticUserId).toBe(7);
  });

  it("blocks reassignment when the request is Confirmado", async () => {
    const created = await reservationRequestRepository.create(buildRequest());
    await useCase.execute(created.requestId, 7, 1);
    created.status = ReservationRequestStatus.CONFIRMED;

    await expect(useCase.execute(created.requestId, 8, 1, 7)).rejects.toThrow(
      RequestNotReassignableException
    );
    expect(created.logisticUserId).toBe(7);
  });

  it.each([
    ReservationRequestStatus.REJECTED,
    ReservationRequestStatus.COORDINATION_READY,
    ReservationRequestStatus.COORDINATION_INCOMPLETE,
    ReservationRequestStatus.PROPOSAL_GENERATED,
    ReservationRequestStatus.COMPLETED,
    ReservationRequestStatus.CANCELLED,
  ])("blocks reassignment when the request is %s", async (status) => {
    const created = await reservationRequestRepository.create(buildRequest({ status }));

    await expect(useCase.execute(created.requestId, 8, 1)).rejects.toThrow(
      RequestNotReassignableException
    );
  });

  it("rejects when the request does not exist", async () => {
    await expect(useCase.execute(999, 7, 1)).rejects.toThrow(ReservationRequestNotFoundException);
  });

  it("rejects when the current responsible no longer matches (RF-1.2.4.7)", async () => {
    const created = await reservationRequestRepository.create(buildRequest());
    await useCase.execute(created.requestId, 7, 1);

    await expect(useCase.execute(created.requestId, 8, 1, 99)).rejects.toThrow(
      RequestAssignmentConflictException
    );
    expect(created.logisticUserId).toBe(7);
  });

  it("rejects an unassigned request expecting a responsible (RF-1.2.4.7)", async () => {
    const created = await reservationRequestRepository.create(buildRequest());

    await expect(useCase.execute(created.requestId, 8, 1, 7)).rejects.toThrow(
      RequestAssignmentConflictException
    );
    expect(created.logisticUserId).toBeNull();
  });

  it("rejects a concurrent assignment reported by the repository (RF-1.2.4.7)", async () => {
    const created = await reservationRequestRepository.create(buildRequest());
    const racingRepository = {
      findById: async (id) => reservationRequestRepository.findById(id),
      assign: async () => ({ status: "assignment_conflict" }),
    };
    const racingUseCase = new AssignReservationRequestUseCase(racingRepository, userRepository);

    await expect(racingUseCase.execute(created.requestId, 7, 1)).rejects.toThrow(
      RequestAssignmentConflictException
    );
  });

  it("maps repository not_reassignable results to the RF message", async () => {
    const created = await reservationRequestRepository.create(buildRequest());
    const racingRepository = {
      findById: async (id) => reservationRequestRepository.findById(id),
      assign: async () => ({ status: "not_reassignable" }),
    };
    const racingUseCase = new AssignReservationRequestUseCase(racingRepository, userRepository);

    await expect(racingUseCase.execute(created.requestId, 7, 1)).rejects.toThrow(
      RequestNotReassignableException
    );
  });

  it("rejects users that are not active (RF-1.2.4.5)", async () => {
    const inactiveUser = buildUser({
      id: 9,
      fullName: "Ana Inactiva",
      status: UserStatus.INACTIVE,
    });
    userRepository = new InMemoryUserRepository([LOGISTICS_USER, inactiveUser]);
    useCase = new AssignReservationRequestUseCase(reservationRequestRepository, userRepository);
    const created = await reservationRequestRepository.create(buildRequest());

    await expect(useCase.execute(created.requestId, 9, 1)).rejects.toThrow(
      LogisticsUserNotAvailableException
    );
  });

  it("rejects users without the logistics role (RF-1.2.4.5)", async () => {
    const adminUser = buildUser({ id: 10, fullName: "Admin Uno", role: UserRole.ADMIN });
    userRepository = new InMemoryUserRepository([LOGISTICS_USER, adminUser]);
    useCase = new AssignReservationRequestUseCase(reservationRequestRepository, userRepository);
    const created = await reservationRequestRepository.create(buildRequest());

    await expect(useCase.execute(created.requestId, 10, 1)).rejects.toThrow(
      LogisticsUserNotAvailableException
    );
  });

  it("reports the conflicting folio and schedule on overlap (RF-1.2.4.4/5)", async () => {
    const first = await reservationRequestRepository.create(buildRequest());
    await reservationRequestRepository.assign(first.requestId, 7, 1);
    const second = await reservationRequestRepository.create(
      buildRequest({
        folio: "BD-2027-00002",
        eventDateTime: new Date("2027-05-10T11:00:00"),
        eventEndTime: new Date("2027-05-10T13:00:00"),
      })
    );

    try {
      await useCase.execute(second.requestId, 7, 1);
      expect.fail("Should have thrown");
    } catch (error) {
      expect(error).toBeInstanceOf(LogisticsUserNotAvailableException);
      expect(error.conflict).toEqual({
        folio: "BD-2027-00001",
        event_date: "2027-05-10",
        start_time: "10:00",
        end_time: "12:00",
      });
    }
  });

  it("rejects reassigning to a user with an overlapping event (RF-1.2.4.4)", async () => {
    const target = await reservationRequestRepository.create(buildRequest());
    await useCase.execute(target.requestId, 7, 1);

    const otherUserEvent = await reservationRequestRepository.create(
      buildRequest({
        folio: "BD-2027-00003",
        eventDateTime: new Date("2027-05-10T11:00:00"),
        eventEndTime: new Date("2027-05-10T13:00:00"),
      })
    );
    await reservationRequestRepository.assign(otherUserEvent.requestId, 8, 1);

    await expect(useCase.execute(target.requestId, 8, 1, 7)).rejects.toThrow(
      LogisticsUserNotAvailableException
    );
    expect(target.logisticUserId).toBe(7);
  });

  it("allows assigning the same employee to non-overlapping events (RF-1.2.4.4)", async () => {
    const first = await reservationRequestRepository.create(buildRequest());
    await reservationRequestRepository.assign(first.requestId, 7, 1);
    const second = await reservationRequestRepository.create(
      buildRequest({
        folio: "BD-2027-00002",
        eventDateTime: new Date("2027-05-10T12:00:00"),
        eventEndTime: new Date("2027-05-10T14:00:00"),
      })
    );

    await useCase.execute(second.requestId, 7, 1);

    expect(second.logisticUserId).toBe(7);
    expect(second.status).toBe(ReservationRequestStatus.ASSIGNED);
  });

  it("maps repository unavailable users to the RF message (RF-1.2.4.5)", async () => {
    const created = await reservationRequestRepository.create(buildRequest());
    const unavailableRepository = {
      findById: async (id) => reservationRequestRepository.findById(id),
      assign: async () => ({ status: "user_unavailable" }),
    };
    const racingUseCase = new AssignReservationRequestUseCase(
      unavailableRepository,
      userRepository
    );

    await expect(racingUseCase.execute(created.requestId, 7, 1)).rejects.toThrow(
      LogisticsUserNotAvailableException
    );
  });
});

describe("GetAvailableLogisticsUsersUseCase", () => {
  it("returns only active logistics users (RF-1.2.4.10)", async () => {
    const userRepository = new InMemoryUserRepository([
      LOGISTICS_USER,
      buildUser({ id: 11, fullName: "Ana Logística", status: UserStatus.ACTIVE }),
      buildUser({ id: 12, fullName: "Inactivo", status: UserStatus.INACTIVE }),
      buildUser({ id: 13, fullName: "Admin", role: UserRole.ADMIN, status: UserStatus.ACTIVE }),
    ]);
    const useCase = new GetAvailableLogisticsUsersUseCase(userRepository);

    const result = await useCase.execute();

    expect(result.data.users).toEqual([
      { id: 11, employee_id: "EMP-008", full_name: "Ana Logística" },
      { id: 7, employee_id: "EMP-007", full_name: "David Torres" },
    ]);
  });

  it("returns an empty list when there are no logistics users (RF-1.2.4.12)", async () => {
    const useCase = new GetAvailableLogisticsUsersUseCase(new InMemoryUserRepository([]));

    const result = await useCase.execute();

    expect(result.data.users).toEqual([]);
  });
});
