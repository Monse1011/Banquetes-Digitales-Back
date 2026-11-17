const { humanResourceCost } = require("./human-resource-cost");

const at = (text) => new Date(`${text}-06:00`);

describe("humanResourceCost (horas del evento × precio por hora)", () => {
  it("multiplies whole hours by the hourly price", () => {
    expect(humanResourceCost(60, at("2030-05-01T18:00:00"), at("2030-05-01T23:00:00"))).toBe(300);
  });

  it("prorates by minutes without rounding hours up", () => {
    // 90 min = 1.5 h; 45 min = 0.75 h
    expect(humanResourceCost(100, at("2030-05-01T18:00:00"), at("2030-05-01T19:30:00"))).toBe(150);
    expect(humanResourceCost(100, at("2030-05-01T18:00:00"), at("2030-05-01T18:45:00"))).toBe(75);
    // 1 min de $100/h = $1.6666... -> centavos
    expect(humanResourceCost(100, at("2030-05-01T18:00:00"), at("2030-05-01T18:01:00"))).toBe(1.67);
  });

  it("works when the event crosses midnight", () => {
    expect(humanResourceCost(100, at("2030-05-01T22:00:00"), at("2030-05-02T01:30:00"))).toBe(350);
  });

  it("costs 0 for rows created before the precio column existed", () => {
    expect(humanResourceCost(null, at("2030-05-01T18:00:00"), at("2030-05-01T23:00:00"))).toBe(0);
    expect(humanResourceCost(undefined, at("2030-05-01T18:00:00"), at("2030-05-01T23:00:00"))).toBe(
      0
    );
  });
});
