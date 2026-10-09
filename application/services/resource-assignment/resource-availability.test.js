const {
  blockingPeriod,
  peakCommittedQuantity,
  availableQuantity,
} = require("./resource-availability");

function assignment(requestId, quantity, start, end, resourceId = 1) {
  return {
    requestId,
    resourceId,
    assignedQuantity: quantity,
    eventStart: new Date(2026, 11, 24, start),
    eventEnd: new Date(2026, 11, 24, end),
  };
}

describe("resource availability (RF-2.3.2.5, RF-2.3.2.12, RF-2.3.2.13)", () => {
  const period = blockingPeriod(new Date(2026, 11, 24, 12), new Date(2026, 11, 24, 15));

  it("blocks the event duration plus 3 hours", () => {
    expect(period.end).toEqual(new Date(2026, 11, 24, 18));
  });

  it("does not conflict when the other event ends exactly 3 hours before", () => {
    expect(peakCommittedQuantity([assignment(2, 5, 6, 9)], period)).toBe(0);
  });

  it("conflicts when the other event ends within the 3 hours before the start", () => {
    expect(peakCommittedQuantity([assignment(2, 5, 7, 10)], period)).toBe(5);
  });

  it("uses the peak simultaneous quantity instead of the sum", () => {
    // 10-11 (+3h = 14) y 15-16 no coinciden entre sí dentro del periodo.
    const assignments = [assignment(2, 4, 10, 11), assignment(3, 6, 15, 16)];

    expect(peakCommittedQuantity(assignments, period)).toBe(6);
  });

  it("counts once a confirmed and a provisional assignment of the same request", () => {
    const assignments = [assignment(2, 3, 12, 15), assignment(2, 5, 12, 15)];

    expect(peakCommittedQuantity(assignments, period)).toBe(5);
  });

  it("subtracts the committed quantity from the stock of active resources only", () => {
    const resource = { id: 1, totalQuantity: 10, isActive: true };
    const others = [assignment(2, 4, 13, 14), assignment(3, 9, 13, 14, 2)];

    expect(availableQuantity(resource, others, period)).toBe(6);
    expect(availableQuantity({ ...resource, isActive: false }, others, period)).toBe(0);
  });
});
