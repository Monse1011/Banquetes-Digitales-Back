const { isWithinClosureDay } = require("./closure-window");
const { parseMeridaDateTime: at } = require("./merida-time");

describe("isWithinClosureDay (RF-2.3.6.1, opción B)", () => {
  const start = at("2035-06-01T18:00:00-06:00");

  it("permite cerrar el día del evento, incluso después de end_at", () => {
    const end = at("2035-06-01T23:00:00-06:00");

    expect(isWithinClosureDay(start, end, at("2035-06-01T23:45:00-06:00"))).toBe(true);
    expect(isWithinClosureDay(start, end, at("2035-06-01T23:59:59-06:00"))).toBe(true);
    expect(isWithinClosureDay(start, end, at("2035-06-02T00:00:00-06:00"))).toBe(false);
    expect(isWithinClosureDay(start, end, at("2035-05-31T23:59:59-06:00"))).toBe(false);
  });

  it("si cruza medianoche, la ventana llega hasta el fin del día de end_at", () => {
    const end = at("2035-06-02T01:00:00-06:00");

    expect(isWithinClosureDay(start, end, at("2035-06-02T23:59:59-06:00"))).toBe(true);
    expect(isWithinClosureDay(start, end, at("2035-06-03T00:00:00-06:00"))).toBe(false);
  });

  it("sin end_at solo cuenta el día de inicio", () => {
    expect(isWithinClosureDay(start, null, at("2035-06-01T23:59:59-06:00"))).toBe(true);
    expect(isWithinClosureDay(start, null, at("2035-06-02T00:00:00-06:00"))).toBe(false);
  });
});
