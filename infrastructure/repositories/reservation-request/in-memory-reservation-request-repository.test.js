const {
  InMemoryReservationRequestRepository,
} = require("./in-memory-reservation-request-repository");
const {
  ReservationRequest,
} = require("../../../domain/entities/reservation-request/reservation-request");
const {
  ReservationRequestStatus,
} = require("../../../domain/enums/reservation-request/request-status");
const {
  ReservationRequestSortField,
} = require("../../../domain/enums/reservation-request/reservation-request-sort-field");

function buildRequest(overrides = {}) {
  return new ReservationRequest(
    overrides.requestId,
    overrides.folio ?? "BD-2024-00001",
    1,
    null,
    overrides.eventDateTime ?? new Date(),
    overrides.eventEndTime ?? new Date(Date.now() + 3 * 60 * 60 * 1000),
    50,
    "123 Main St",
    overrides.status ?? ReservationRequestStatus.PENDING,
    new Date(),
    [1, 2],
    overrides.logisticUserId ?? null
  );
}

describe("InMemoryReservationRequestRepository", () => {
  let repository;

  beforeEach(() => {
    repository = new InMemoryReservationRequestRepository();
  });

  it("should create a request", async () => {
    const created = await repository.create(buildRequest());

    expect(created.requestId).toBeDefined();
    expect(created.folio).toBe("BD-2024-00001");
  });

  it("should find a request by id", async () => {
    const created = await repository.create(buildRequest());
    const found = await repository.findById(created.requestId);

    expect(found).toBeDefined();
    expect(found.folio).toBe("BD-2024-00001");
  });

  it("should update a request", async () => {
    const created = await repository.create(buildRequest());
    created.status = ReservationRequestStatus.APPROVED;
    await repository.update(created);
    const updated = await repository.findById(created.requestId);

    expect(updated.status).toBe(ReservationRequestStatus.APPROVED);
  });

  it("should find all with pagination", async () => {
    for (let i = 0; i < 5; i++) {
      await repository.create(buildRequest({ folio: `BD-2024-${i.toString().padStart(5, "0")}` }));
    }

    const result = await repository.findAll(
      {},
      { field: ReservationRequestSortField.EVENT_DATE, direction: "asc" },
      1,
      3
    );

    expect(result.requests).toHaveLength(3);
    expect(result.totalRecords).toBe(5);
  });

  it("should filter by status", async () => {
    await repository.create(buildRequest({ status: ReservationRequestStatus.PENDING }));
    await repository.create(buildRequest({ folio: "BD-2024-00002" }));

    const approved = await repository.findAll({}, {}, 1, 10);
    approved.requests[1].status = ReservationRequestStatus.APPROVED;
    await repository.update(approved.requests[1]);

    const result = await repository.findAll(
      { status: ReservationRequestStatus.APPROVED },
      { field: ReservationRequestSortField.EVENT_DATE, direction: "asc" },
      1,
      10
    );

    expect(result.requests).toHaveLength(1);
    expect(result.requests[0].status).toBe(ReservationRequestStatus.APPROVED);
  });

  describe("assign", () => {
    it("should assign an approved request and record audit fields (RF-1.2.4.3/14)", async () => {
      const created = await repository.create(buildRequest());
      created.status = ReservationRequestStatus.APPROVED;

      const result = await repository.assign(created.requestId, 7, 1);

      expect(result.status).toBe("assigned");
      expect(created.status).toBe(ReservationRequestStatus.ASSIGNED);
      expect(created.logisticUserId).toBe(7);
      expect(created.assignedByUserId).toBe(1);
      expect(created.assignedAt).toBeInstanceOf(Date);
    });

    it("should reassign a request that already has a responsible", async () => {
      const created = await repository.create(
        buildRequest({ status: ReservationRequestStatus.APPROVED })
      );
      await repository.assign(created.requestId, 7, 1);

      const result = await repository.assign(created.requestId, 8, 1, 7);

      expect(result.status).toBe("assigned");
      expect(created.logisticUserId).toBe(8);
    });

    it("should reject reassignment when the current responsible no longer matches", async () => {
      const created = await repository.create(
        buildRequest({ status: ReservationRequestStatus.APPROVED })
      );
      await repository.assign(created.requestId, 7, 1);

      const result = await repository.assign(created.requestId, 8, 1, 99);

      expect(result.status).toBe("assignment_conflict");
      expect(created.logisticUserId).toBe(7);
    });

    it("should reject requests that cannot be reassigned (RF-1.2.4.2 bloqueo)", async () => {
      const created = await repository.create(
        buildRequest({ status: ReservationRequestStatus.CONFIRMED, logisticUserId: 7 })
      );

      const result = await repository.assign(created.requestId, 8, 1, 7);

      expect(result.status).toBe("not_reassignable");
      expect(created.logisticUserId).toBe(7);
    });

    it("should reject overlapping schedules and report the conflict (RF-1.2.4.4/5)", async () => {
      const start = new Date("2027-05-10T10:00:00");
      const end = new Date("2027-05-10T12:00:00");

      const first = await repository.create(
        buildRequest({
          status: ReservationRequestStatus.APPROVED,
          eventDateTime: start,
          eventEndTime: end,
        })
      );
      await repository.assign(first.requestId, 7, 1);

      const second = await repository.create(
        buildRequest({
          folio: "BD-2024-00009",
          status: ReservationRequestStatus.APPROVED,
          eventDateTime: new Date("2027-05-10T11:30:00"),
          eventEndTime: new Date("2027-05-10T13:30:00"),
        })
      );

      const result = await repository.assign(second.requestId, 7, 1);

      expect(result.status).toBe("overlap");
      expect(result.conflicts[0].folio).toBe("BD-2024-00001");
    });

    it("should allow same-day events that do not overlap (RF-1.2.4.4)", async () => {
      const first = await repository.create(
        buildRequest({
          status: ReservationRequestStatus.APPROVED,
          eventDateTime: new Date("2027-05-10T10:00:00"),
          eventEndTime: new Date("2027-05-10T12:00:00"),
        })
      );
      await repository.assign(first.requestId, 7, 1);

      const second = await repository.create(
        buildRequest({
          status: ReservationRequestStatus.APPROVED,
          eventDateTime: new Date("2027-05-10T12:00:00"),
          eventEndTime: new Date("2027-05-10T14:00:00"),
        })
      );

      const result = await repository.assign(second.requestId, 7, 1);

      expect(result.status).toBe("assigned");
    });
  });
});
