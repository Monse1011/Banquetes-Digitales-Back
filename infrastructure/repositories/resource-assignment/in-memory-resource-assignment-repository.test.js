const {
  InMemoryResourceAssignmentRepository,
} = require("./in-memory-resource-assignment-repository");
const {
  ResourceAssignment,
} = require("../../../domain/entities/resource-assignment/resource-assignment");
const { AssignmentStatus } = require("../../../domain/enums/resource-assignment/assignment-status");
const {
  ResourceSufficiency,
} = require("../../../domain/enums/resource-assignment/resource-sufficiency");
const {
  blockingPeriod,
} = require("../../../application/services/resource-assignment/resource-availability");
const { Transaction } = require("../../services/transaction/transaction");

const EVENT_START = new Date("2026-12-24T18:00:00");
const EVENT_END = new Date("2026-12-24T23:00:00");
const PERIOD = blockingPeriod(EVENT_START, EVENT_END);

function buildAssignment(requestId, overrides = {}) {
  return new ResourceAssignment(
    overrides.id,
    requestId,
    overrides.resourceId ?? 1,
    overrides.quantity ?? 2,
    overrides.quantity ?? 2,
    10,
    ResourceSufficiency.SUFFICIENT,
    overrides.status ?? AssignmentStatus.PROVISIONAL,
    EVENT_START,
    EVENT_END,
    EVENT_START,
    EVENT_END,
    null,
    7,
    new Date()
  );
}

describe("InMemoryResourceAssignmentRepository", () => {
  let repository;

  beforeEach(() => {
    repository = new InMemoryResourceAssignmentRepository();
  });

  it("saves provisional assignments when the blocking ones did not change", async () => {
    const blocking = await repository.findBlocking([1], PERIOD, 1);

    const saved = await repository.saveProvisional([buildAssignment(1)], blocking);

    expect(saved).toHaveLength(1);
    expect(saved[0].id).toBe(1);
  });

  it("rejects saving when another request blocked the resource meanwhile (RF-2.3.2.22)", async () => {
    const staleBlocking = await repository.findBlocking([1], PERIOD, 1);
    await repository.saveProvisional(
      [buildAssignment(2)],
      await repository.findBlocking([1], PERIOD, 2)
    );

    const saved = await repository.saveProvisional([buildAssignment(1)], staleBlocking);

    expect(saved).toBeNull();
    expect(await repository.findByRequest(1)).toEqual([]);
  });

  it("does not reject when another request only confirms its assignments", async () => {
    await repository.saveProvisional([buildAssignment(2)], []);
    const blocking = await repository.findBlocking([1], PERIOD, 1);
    const [other] = await repository.findByRequest(2);
    other.confirm(10, 7, new Date());
    await repository.confirm([other], [], await repository.findBlocking([1], PERIOD, 2));

    const saved = await repository.saveProvisional([buildAssignment(1)], blocking);

    expect(saved).not.toBeNull();
  });

  it("releases only the provisional assignments of the request", async () => {
    await repository.saveProvisional([buildAssignment(1, { resourceId: 1 })], []);
    const [confirmed] = await repository.findByRequest(1);
    confirmed.confirm(10, 7, new Date());
    await repository.confirm([confirmed], [], []);
    await repository.saveProvisional([buildAssignment(1, { resourceId: 2 })], []);

    const released = await repository.releaseProvisional(1);

    expect(released.map((assignment) => assignment.resourceId)).toEqual([2]);
    expect((await repository.findByRequest(1)).map((assignment) => assignment.status)).toEqual([
      AssignmentStatus.CONFIRMED,
    ]);
  });

  it("releases the provisional assignment of a single resource", async () => {
    await repository.saveProvisional(
      [buildAssignment(1, { resourceId: 1 }), buildAssignment(1, { resourceId: 2 })],
      []
    );

    const released = await repository.releaseProvisionalResource(1, 2);

    expect(released.status).toBe(AssignmentStatus.RELEASED);
    expect((await repository.findByRequest(1)).map((assignment) => assignment.resourceId)).toEqual([
      1,
    ]);
    expect(await repository.releaseProvisionalResource(1, 2)).toBeNull();
  });

  it("undoes only its own writes when the transaction rolls back", async () => {
    await repository.saveProvisional([buildAssignment(1)], []);
    const [provisional] = await repository.findByRequest(1);
    const transaction = new Transaction();

    provisional.confirm(10, 7, new Date());
    await repository.confirm([provisional], [], [], transaction);
    await repository.saveProvisional([buildAssignment(1, { resourceId: 2 })], [], transaction);
    await repository.saveProvisional([buildAssignment(2, { resourceId: 3 })], []);
    transaction.undoInMemoryChanges();

    expect(await repository.findByRequest(1)).toEqual([
      expect.objectContaining({ resourceId: 1, status: AssignmentStatus.PROVISIONAL }),
    ]);
    expect(await repository.findByRequest(2)).toHaveLength(1);
  });
});
