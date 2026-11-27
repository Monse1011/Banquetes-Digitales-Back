const { validateLeadTime, addMonths } = require("./booking-lead-time");

// Las horas son de Mérida (UTC-6). "Hoy" = 6 de noviembre de 2026.
const at = (text) => new Date(`${text}-06:00`);
const NOW = at("2026-11-06T10:00:00");

describe("addMonths", () => {
  it("suma meses de calendario y ajusta al último día del mes", () => {
    expect(addMonths("2026-11-06", 2)).toBe("2027-01-06");
    expect(addMonths("2027-01-31", 1)).toBe("2027-02-28");
    expect(addMonths("2026-11-30", 3)).toBe("2027-02-28");
  });
});

describe("validateLeadTime", () => {
  it.each([
    // [evento, invitados, válido]
    ["2027-01-05T20:00:00", 30, false], // alta, 2 meses: mínimo 6-ene
    ["2027-01-06T00:30:00", 30, true],
    ["2027-01-06T20:00:00", 31, false], // alta, >30: 3 meses, mínimo 6-feb
    ["2027-02-06T20:00:00", 31, true],
    ["2027-04-05T20:00:00", 30, true], // media, 1 mes
    ["2026-12-20T20:00:00", 10, false], // alta
    ["2026-11-20T20:00:00", 10, false], // alta
  ])("evento %s con %i invitados -> válido: %s", (event, guests, valid) => {
    expect(validateLeadTime(at(event), guests, NOW) === undefined).toBe(valid);
  });

  it("aplica el plazo de temporada baja y media", () => {
    const now = at("2026-05-01T10:00:00");
    expect(validateLeadTime(at("2026-06-15T20:00:00"), 20, now)).toBeUndefined(); // baja, 1 mes
    expect(validateLeadTime(at("2026-07-15T20:00:00"), 20, now)).toBeUndefined();
    expect(validateLeadTime(at("2026-06-15T20:00:00"), 50, now)).toMatch(/2 meses.*2026-07-01/); // baja, >30
    expect(validateLeadTime(at("2026-05-20T20:00:00"), 20, now)).toMatch(/temporada media.*1 mes /);
  });
});
