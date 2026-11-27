const { validateEventWindow, isStartInPast } = require("./event-window");

// Las horas son de Mérida (UTC-6).
const at = (text) => new Date(`${text}-06:00`);

describe("validateEventWindow (termina al día siguiente)", () => {
  it("accepts an end later the same day", () => {
    expect(
      validateEventWindow(at("2030-05-01T18:00:00"), at("2030-05-01T23:00:00"))
    ).toBeUndefined();
  });

  it("accepts next day when the end time is <= the start time", () => {
    expect(
      validateEventWindow(at("2030-05-01T18:00:00"), at("2030-05-02T03:00:00"))
    ).toBeUndefined();
    expect(
      validateEventWindow(at("2030-05-01T18:00:00"), at("2030-05-02T18:00:00"))
    ).toBeUndefined();
  });

  it("rejects next day when the end time is later than the start time", () => {
    expect(validateEventWindow(at("2030-05-01T18:00:00"), at("2030-05-02T20:00:00"))).toMatch(
      /día siguiente/
    );
  });

  it("rejects an end that is not after the start", () => {
    expect(validateEventWindow(at("2030-05-01T18:00:00"), at("2030-05-01T18:00:00"))).toMatch(
      /posterior/
    );
  });

  it("rejects an end more than one day after the start", () => {
    expect(validateEventWindow(at("2030-05-01T18:00:00"), at("2030-05-03T01:00:00"))).toMatch(
      /más de un día/
    );
  });

  it("uses the Merida calendar day, not UTC", () => {
    // 20:00 y 23:00 en Mérida son el mismo día aunque en UTC el fin ya sea el siguiente.
    expect(
      validateEventWindow(at("2030-05-01T20:00:00"), at("2030-05-01T23:00:00"))
    ).toBeUndefined();
  });
});

describe("isStartInPast", () => {
  const now = at("2030-05-01T12:00:00");

  it("rejects a start earlier today and accepts one later today", () => {
    expect(isStartInPast(at("2030-05-01T09:00:00"), now)).toBe(true);
    expect(isStartInPast(at("2030-05-01T12:00:00"), now)).toBe(true);
    expect(isStartInPast(at("2030-05-01T12:01:00"), now)).toBe(false);
  });
});
