const { ConfirmedResourceAdapter } = require("./confirmed-resource-adapter");
const {
  GetRequestAgreementsUseCase,
} = require("../../../application/use-cases/proposal/get-request-agreements-use-case");
const { AssignmentStatus } = require("../../../domain/enums/resource-assignment/assignment-status");
const {
  ResourceSufficiency,
} = require("../../../domain/enums/resource-assignment/resource-sufficiency");
const {
  ReservationRequestStatus,
} = require("../../../domain/enums/reservation-request/request-status");

it("preserves requested and available quantities, zero assignment and shortage notes through agreements and adjustments", async () => {
  const start = new Date("2035-06-01T20:00:00Z");
  const end = new Date("2035-06-01T23:00:00Z");
  const row = {
    id: 1,
    requestId: 3,
    resourceId: 7,
    quantity: 0,
    requestedQuantity: 30,
    availableQuantity: 10,
    sufficiency: ResourceSufficiency.INSUFFICIENT,
    observation: "Faltan 20 sillas; consultar al cliente.",
    status: AssignmentStatus.CONFIRMED,
    usageStart: start,
    usageEnd: end,
  };
  const assignments = {
    findByRequest: async () => [row],
    findBlocking: async () => [],
    confirm: async () => true,
  };
  const resources = {
    findByIds: async () => [
      {
        id: 7,
        name: "Sillas",
        type: "MATERIAL",
        unitCost: 5,
        totalQuantity: 10,
        isActive: true,
      },
    ],
  };
  const adapter = new ConfirmedResourceAdapter(assignments, resources);
  const useCase = new GetRequestAgreementsUseCase(
    {
      findById: async () => ({
        requestId: 3,
        logisticUserId: 9,
        status: ReservationRequestStatus.COORDINATION_INCOMPLETE,
        eventAddress: "Lugar",
        eventDateTime: start,
        eventEndTime: end,
      }),
    },
    { findById: async () => null },
    adapter,
    {
      findLatestByRequestId: async () => ({
        id: 4,
        location: "Lugar",
        startDatetime: start,
        endDatetime: end,
        observations: "Nota del acuerdo",
      }),
    },
    { findLatestByRequest: async () => ({ observations: "Revisar mobiliario" }) }
  );
  const before = (await useCase.execute(3, 9)).data;
  expect(before.assigned_resources[0]).toMatchObject({
    quantity: 0,
    requested_quantity: 30,
    available_quantity: 10,
    observation: row.observation,
    sufficiency: ResourceSufficiency.INSUFFICIENT,
  });
  expect(before.observations).toBe("Nota del acuerdo");
  expect(before.confirmation_observations).toBe("Revisar mobiliario");
  await adapter.syncAssignments(3, [{ resourceId: 7, quantity: 8 }], start, end);
  const after = (await useCase.execute(3, 9)).data.assigned_resources[0];
  expect(after).toEqual({ ...before.assigned_resources[0], quantity: 8 });
});
