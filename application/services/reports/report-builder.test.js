const { buildReport } = require("./report-builder");

const NOW = new Date("2026-10-25T22:30:00-06:00");
const REQUESTS_MONTH = {
  type: "REQUESTS",
  period_type: "MONTH",
  month: "2026-10",
  client_email: null,
  filters: { period_type: "MONTH", month: "2026-10", client_email: null },
};

const requestRow = (overrides = {}) => ({
  folio: "BD-2026-00012",
  client_name: "Ana López",
  request_date: new Date("2026-10-03T16:15:00Z"),
  event_date: "2026-11-14",
  status: "PENDING",
  ...overrides,
});

describe("buildReport: REQUESTS", () => {
  it("arma título, tabla con DateTime de Mérida, resumen y gráfica de barras con nota (ejemplo del contrato 13)", () => {
    const report = buildReport({
      query: REQUESTS_MONTH,
      rows: [requestRow()],
      now: NOW,
    });

    expect(report.type).toBe("REQUESTS");
    expect(report.title).toBe("Solicitudes de reservación recibidas");
    expect(report.generated_at).toBe("2026-10-25T22:30:00-06:00");
    expect(report.filters).toEqual(REQUESTS_MONTH.filters);
    expect(report.summary).toEqual({ total: 1 });
    expect(report.table).toEqual([
      {
        folio: "BD-2026-00012",
        client_name: "Ana López",
        request_date: "2026-10-03T10:15:00-06:00",
        event_date: "2026-11-14",
        status: "PENDING",
      },
    ]);
    expect(report.chart).toEqual({
      type: "bar",
      x_label: "Día",
      y_label: "Solicitudes",
      buckets: [
        { label: "2026-10-01", count: 0 },
        { label: "2026-10-02", count: 0 },
        { label: "2026-10-03", count: 1 },
      ],
      note: "Se muestran 3 de 31 intervalos.",
    });
  });

  it("sin gráfica cuando el periodo es un único día (RF-1.2.15.5.2)", () => {
    const report = buildReport({
      query: {
        type: "REQUESTS",
        period_type: "DAY",
        date: "2026-10-03",
        filters: { period_type: "DAY", date: "2026-10-03", client_email: null },
      },
      rows: [requestRow()],
      now: NOW,
    });

    expect(report.chart).toBeNull();
    expect(report.summary.total).toBe(1);
  });

  it("rangos mayores a 31 días agrupan por mes y NONE deriva el rango de los datos (AD-08)", () => {
    const range = buildReport({
      query: {
        type: "REQUESTS",
        period_type: "RANGE",
        from: "2026-01-05",
        to: "2026-06-05",
        filters: { period_type: "RANGE", from: "2026-01-05", to: "2026-06-05", client_email: null },
      },
      rows: [requestRow({ request_date: new Date("2026-03-01T12:00:00Z") })],
      now: NOW,
    });

    expect(range.chart.x_label).toBe("Mes");
    expect(range.chart.buckets).toEqual([
      { label: "2026-01", count: 0 },
      { label: "2026-02", count: 0 },
      { label: "2026-03", count: 1 },
    ]);
    expect(range.chart.note).toBe("Se muestran 3 de 6 intervalos.");

    const none = buildReport({
      query: {
        type: "REQUESTS",
        period_type: "NONE",
        filters: { period_type: "NONE", client_email: null },
      },
      rows: [
        requestRow({ request_date: new Date("2025-12-31T23:00:00Z") }),
        requestRow({ folio: "BD-2026-00002", request_date: new Date("2026-02-01T12:00:00Z") }),
      ],
      now: NOW,
    });

    expect(none.chart.buckets.map((b) => b.label)).toEqual(["2025-12", "2026-01", "2026-02"]);
    expect(none.chart.note).toBeNull();
  });
});

describe("buildReport: EVENTS", () => {
  const eventRow = {
    folio: "BD-2026-00001",
    client_name: "Luis Pérez",
    event_date: "2026-10-05",
    services: ["Banquetes", "Decoración"],
    promotion: { name: "Verano", status: "INACTIVE" },
  };

  it("pasa servicios y promoción vigentes desde el repositorio y usa gráfica de líneas", () => {
    const report = buildReport({
      query: {
        type: "EVENTS",
        period_type: "MONTH",
        month: "2026-10",
        filters: { period_type: "MONTH", month: "2026-10", client_email: null },
      },
      rows: [eventRow],
      now: NOW,
    });

    expect(report.table).toEqual([eventRow]);
    expect(report.summary).toEqual({ total: 1 });
    expect(report.chart.type).toBe("line");
    expect(report.chart.y_label).toBe("Eventos");
    expect(report.chart.buckets[4]).toEqual({ label: "2026-10-05", count: 1 });
  });

  it("promotion null se conserva", () => {
    const report = buildReport({
      query: {
        type: "EVENTS",
        period_type: "NONE",
        filters: { period_type: "NONE", client_email: null },
      },
      rows: [{ ...eventRow, promotion: null }],
      now: NOW,
    });

    expect(report.table[0].promotion).toBeNull();
  });
});

describe("buildReport: SERVICES", () => {
  const rows = [
    { service_id: 3, name: "Música", status: "ACTIVE", times_contracted: 5 },
    { service_id: 1, name: "Banquetes", status: "ACTIVE", times_contracted: 10 },
    { service_id: 9, name: "Banquetes", status: "INACTIVE", times_contracted: 10 },
    { service_id: 7, name: "Decoración", status: "INACTIVE", times_contracted: 5 },
  ];
  const query = {
    type: "SERVICES",
    period_type: "NONE",
    filters: { period_type: "NONE", client_email: null, service_id: null },
  };

  it("ordena por cantidad, luego nombre y vigente primero; suma el denominador y calcula porcentajes con 2 decimales", () => {
    const report = buildReport({ query, rows, now: NOW });

    expect(report.summary.total).toBe(30);
    // 10 contr.: Banquetes vigente antes que el homónimo inactivo; 5 contr.: Decoración
    // (D) antes que Música (M), sin distinguir vigencia por ser nombres distintos.
    expect(report.table.map((row) => row.service_id)).toEqual([1, 9, 7, 3]);
    expect(report.table[0]).toEqual({
      service_id: 1,
      name: "Banquetes",
      status: "ACTIVE",
      times_contracted: 10,
      percentage: 33.33,
    });
    expect(report.table[2]).toEqual({
      service_id: 7,
      name: "Decoración (No vigente)",
      status: "INACTIVE",
      times_contracted: 5,
      percentage: 16.67,
    });
  });

  it("gráfica de pastel con un segmento por fila; null con un solo servicio (RF-1.2.15.5.6)", () => {
    const report = buildReport({ query, rows, now: NOW });
    expect(report.chart.type).toBe("pie");
    expect(report.chart.buckets).toEqual([
      { label: "Banquetes", count: 10 },
      { label: "Banquetes (No vigente)", count: 10 },
      { label: "Decoración (No vigente)", count: 5 },
      { label: "Música", count: 5 },
    ]);

    const single = buildReport({ query, rows: [rows[0]], now: NOW });
    expect(single.chart).toBeNull();
    expect(single.summary.total).toBe(5);
    expect(single.table[0].percentage).toBe(100);
  });
});

describe("buildReport: PROMOTIONS", () => {
  const rows = [
    { promotion_id: 2, name: "Verano", status: "INACTIVE", times_used: 3 },
    { promotion_id: 1, name: "Temporada", status: "ACTIVE", times_used: 7 },
  ];

  it("gráfica de barras por promoción con nombre actual y sufijo (RF-1.2.15.5.7/15.5.8)", () => {
    const report = buildReport({
      query: {
        type: "PROMOTIONS",
        period_type: "NONE",
        filters: { period_type: "NONE", client_email: null, promotion_id: null },
      },
      rows,
      now: NOW,
    });

    expect(report.summary.total).toBe(10);
    expect(report.table[0]).toEqual({
      promotion_id: 1,
      name: "Temporada",
      status: "ACTIVE",
      times_used: 7,
      percentage: 70,
    });
    expect(report.table[1].name).toBe("Verano (No vigente)");
    expect(report.chart.type).toBe("bar");
    expect(report.chart.x_label).toBe("Promoción");
    expect(report.chart.y_label).toBe("Usos");
    expect(report.chart.buckets).toEqual([
      { label: "Temporada", count: 7 },
      { label: "Verano (No vigente)", count: 3 },
    ]);
  });

  it("sin resultados: total 0, tabla y gráfica vacías", () => {
    const report = buildReport({
      query: {
        type: "PROMOTIONS",
        period_type: "NONE",
        filters: { period_type: "NONE", client_email: null },
      },
      rows: [],
      now: NOW,
    });

    expect(report.summary).toEqual({ total: 0 });
    expect(report.table).toEqual([]);
    expect(report.chart).toBeNull();
  });
});
