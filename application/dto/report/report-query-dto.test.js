const { parseReportQuery } = require("./report-query-dto");
const { ReportMessages } = require("../../../domain/constants/report-messages");

const VALIDATION = (message) =>
  expect.objectContaining({ name: "ValidationException", status: 400, message });

describe("parseReportQuery (contratos 13 y 14)", () => {
  it.each([
    ["ausente", {}],
    ["vacío", { type: "" }],
    ["desconocido", { type: "FINANCES" }],
    ["sensible a mayúsculas", { type: "requests" }],
  ])("400 %s: %s", (_case, query) => {
    expect(() => parseReportQuery(query)).toThrow(VALIDATION(ReportMessages.INVALID_TYPE));
  });

  it("acepta REQUESTS sin más filtros con period_type NONE por defecto (RF-1.2.15.4)", () => {
    const result = parseReportQuery({ type: "REQUESTS" });

    expect(result.type).toBe("REQUESTS");
    expect(result.period_type).toBe("NONE");
    expect(result.client_email).toBeNull();
    expect(result.filters).toEqual({ period_type: "NONE", client_email: null });
  });

  it("period_type vacío equivale a NONE y uno desconocido responde 400 genérico", () => {
    expect(parseReportQuery({ type: "EVENTS", period_type: "" }).period_type).toBe("NONE");
    expect(() => parseReportQuery({ type: "EVENTS", period_type: "WEEK" })).toThrow(
      VALIDATION(ReportMessages.INVALID_QUERY)
    );
  });

  describe("DAY", () => {
    it("exige date (RF-1.2.15.3.11)", () => {
      expect(() => parseReportQuery({ type: "REQUESTS", period_type: "DAY" })).toThrow(
        VALIDATION(ReportMessages.MISSING_DATE)
      );
    });

    it.each(["2026-13-01", "2026-02-30", "01-05-2026", "2026-1-5"])(
      "rechaza formatos inválidos: %s",
      (date) => {
        expect(() => parseReportQuery({ type: "REQUESTS", period_type: "DAY", date })).toThrow(
          VALIDATION(ReportMessages.INVALID_QUERY)
        );
      }
    );

    it("normaliza la fecha", () => {
      expect(
        parseReportQuery({ type: "REQUESTS", period_type: "DAY", date: " 2026-10-03 " })
      ).toMatchObject({
        date: "2026-10-03",
        filters: { period_type: "DAY", date: "2026-10-03", client_email: null },
      });
    });
  });

  describe("MONTH", () => {
    it("exige month", () => {
      expect(() => parseReportQuery({ type: "REQUESTS", period_type: "MONTH" })).toThrow(
        VALIDATION(ReportMessages.MISSING_MONTH)
      );
    });

    it.each(["2026-13", "2026-00", "10-2026"])("rechaza month inválido: %s", (month) => {
      expect(() => parseReportQuery({ type: "REQUESTS", period_type: "MONTH", month })).toThrow(
        VALIDATION(ReportMessages.INVALID_QUERY)
      );
    });

    it("normaliza el mes", () => {
      expect(
        parseReportQuery({ type: "REQUESTS", period_type: "MONTH", month: "2026-10" })
      ).toMatchObject({
        month: "2026-10",
        filters: { period_type: "MONTH", month: "2026-10", client_email: null },
      });
    });
  });

  describe("RANGE", () => {
    it("exige from y to", () => {
      expect(() =>
        parseReportQuery({ type: "REQUESTS", period_type: "RANGE", from: "2026-10-01" })
      ).toThrow(VALIDATION(ReportMessages.MISSING_RANGE));
      expect(() =>
        parseReportQuery({ type: "REQUESTS", period_type: "RANGE", to: "2026-10-01" })
      ).toThrow(VALIDATION(ReportMessages.MISSING_RANGE));
    });

    it("rechaza from posterior a to (RF-1.2.15.3.10)", () => {
      expect(() =>
        parseReportQuery({
          type: "REQUESTS",
          period_type: "RANGE",
          from: "2026-10-10",
          to: "2026-10-01",
        })
      ).toThrow(VALIDATION(ReportMessages.INVALID_RANGE));
    });

    it("from igual a to es válido", () => {
      expect(
        parseReportQuery({
          type: "REQUESTS",
          period_type: "RANGE",
          from: "2026-10-10",
          to: "2026-10-10",
        })
      ).toMatchObject({ from: "2026-10-10", to: "2026-10-10" });
    });

    it("rechaza formatos inválidos", () => {
      expect(() =>
        parseReportQuery({
          type: "REQUESTS",
          period_type: "RANGE",
          from: "2026-02-31",
          to: "2026-10-01",
        })
      ).toThrow(VALIDATION(ReportMessages.INVALID_QUERY));
    });
  });

  it("client_email se trimea; la cadena vacía significa todos los clientes (RF-1.2.15.3.12)", () => {
    expect(parseReportQuery({ type: "REQUESTS", client_email: "  ana@x.co " }).client_email).toBe(
      "ana@x.co"
    );
    expect(parseReportQuery({ type: "REQUESTS", client_email: "   " }).client_email).toBeNull();
  });

  describe("filtros aplicables por tipo (RF-1.2.15.3.1)", () => {
    it("service_id solo aplica a EVENTS y SERVICES", () => {
      expect(parseReportQuery({ type: "EVENTS", service_id: "7" }).service_id).toBe(7);
      expect(parseReportQuery({ type: "SERVICES", service_id: "7" }).service_id).toBe(7);
      expect(parseReportQuery({ type: "REQUESTS", service_id: "7" }).service_id).toBeNull();
      expect(parseReportQuery({ type: "PROMOTIONS", service_id: "7" }).service_id).toBeNull();
      expect(parseReportQuery({ type: "REQUESTS", service_id: "7" }).filters).not.toHaveProperty(
        "service_id"
      );
    });

    it("promotion_id solo aplica a EVENTS y PROMOTIONS", () => {
      expect(parseReportQuery({ type: "EVENTS", promotion_id: "3" }).promotion_id).toBe(3);
      expect(parseReportQuery({ type: "PROMOTIONS", promotion_id: "3" }).promotion_id).toBe(3);
      expect(parseReportQuery({ type: "REQUESTS", promotion_id: "3" }).promotion_id).toBeNull();
      expect(parseReportQuery({ type: "SERVICES", promotion_id: "3" }).promotion_id).toBeNull();
    });

    it.each([
      ["EVENTS", "service_id", "abc"],
      ["SERVICES", "service_id", "0"],
      ["EVENTS", "promotion_id", "-2"],
      ["PROMOTIONS", "promotion_id", "1.5"],
    ])("rechaza %s no numérico en %s", (type, field, value) => {
      expect(() => parseReportQuery({ type, [field]: value })).toThrow(
        expect.objectContaining({ name: "ValidationException", status: 400 })
      );
    });
  });

  it("echo de filtros del contrato 13 incluye ids y correo cuando aplican", () => {
    const { filters } = parseReportQuery({
      type: "EVENTS",
      period_type: "MONTH",
      month: "2026-10",
      client_email: "ana@x.co",
      service_id: "7",
      promotion_id: "3",
    });

    expect(filters).toEqual({
      period_type: "MONTH",
      month: "2026-10",
      client_email: "ana@x.co",
      service_id: 7,
      promotion_id: 3,
    });
  });

  it("la excepción es una ValidationException real", () => {
    try {
      parseReportQuery({});
      expect.unreachable("debía lanzar ValidationException");
    } catch (error) {
      expect(error).toBeInstanceOf(Error);
      expect(error.name).toBe("ValidationException");
      expect(error.status).toBe(400);
    }
  });
});
