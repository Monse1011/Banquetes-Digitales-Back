const { isValidFolio, normalizeFolio } = require("./folio");

describe("Value Object Folio (RF-3.4.5.1.1)", () => {
  it("acepta el formato BD-AAAA-NNNNN", () => {
    expect(isValidFolio("BD-2026-00123")).toBe(true);
  });

  it("rechaza formatos fuera de la especificación", () => {
    expect(isValidFolio("BD-26-1")).toBe(false);
    expect(isValidFolio("EVT-2026-00123")).toBe(false);
    expect(isValidFolio("BD-2026-001234")).toBe(false);
    expect(isValidFolio("")).toBe(false);
    expect(isValidFolio(null)).toBe(false);
    expect(isValidFolio(undefined)).toBe(false);
    expect(isValidFolio(123)).toBe(false);
  });

  it("normaliza recortando y pasando a mayúsculas", () => {
    expect(normalizeFolio("  bd-2026-00123 ")).toBe("BD-2026-00123");
  });
});
