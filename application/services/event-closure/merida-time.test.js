const { formatMeridaDate, formatMeridaDateTime, parseMeridaDateTime } = require("./merida-time");

describe("merida-time", () => {
  describe("parseMeridaDateTime", () => {
    it("acepta el formato exacto del contrato con offset -06:00", () => {
      const parsed = parseMeridaDateTime("2026-11-15T18:10:00-06:00");

      expect(parsed.toISOString()).toBe("2026-11-16T00:10:00.000Z");
    });

    it.each([
      ["Z", "2026-11-15T18:10:00Z"],
      ["+00:00", "2026-11-15T18:10:00+00:00"],
      ["otro offset", "2026-11-15T18:10:00-05:00"],
      ["sin offset", "2026-11-15T18:10:00"],
      ["con milisegundos", "2026-11-15T18:10:00.000-06:00"],
      ["fecha inexistente", "2026-02-30T18:10:00-06:00"],
      ["hora inexistente", "2026-11-15T24:10:00-06:00"],
      ["segundos inexistentes", "2026-11-15T18:10:60-06:00"],
      ["texto libre", "mañana por la tarde"],
    ])("rechaza %s", (_label, value) => {
      expect(parseMeridaDateTime(value)).toBeNull();
    });

    it("rechaza valores que no son texto", () => {
      expect(parseMeridaDateTime(1763248200000)).toBeNull();
      expect(parseMeridaDateTime(null)).toBeNull();
    });
  });

  describe("formato de salida", () => {
    it("formatea con offset fijo -06:00 y sin milisegundos", () => {
      const instant = new Date("2026-11-16T05:45:07.123Z");

      expect(formatMeridaDateTime(instant)).toBe("2026-11-15T23:45:07-06:00");
    });

    it("devuelve la fecha de Mérida aunque en UTC ya sea el día siguiente", () => {
      expect(formatMeridaDate(new Date("2026-11-16T05:59:59Z"))).toBe("2026-11-15");
      expect(formatMeridaDate(new Date("2026-11-16T06:00:00Z"))).toBe("2026-11-16");
    });

    it("devuelve null para una fecha ausente", () => {
      expect(formatMeridaDateTime(null)).toBeNull();
    });
  });
});
