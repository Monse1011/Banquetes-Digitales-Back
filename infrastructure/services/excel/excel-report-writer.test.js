// AD-02: el buffer se reabre con exceljs para verificar hoja, orden y formatos
// (RF-1.2.15.7.3: el archivo es lo mostrado en pantalla, sin gráfica).
const ExcelJS = require("exceljs");
const { writeReportWorkbook } = require("./excel-report-writer");

const REQUESTS_REPORT = {
  type: "REQUESTS",
  title: "Solicitudes de reservación recibidas",
  filters: { period_type: "MONTH", month: "2026-10", client_email: null },
  generated_at: "2026-10-25T22:30:00-06:00",
  summary: { total: 2 },
  table: [
    {
      folio: "BD-2026-00012",
      client_name: "Ana López",
      request_date: "2026-10-03T10:15:00-06:00",
      event_date: "2026-11-14",
      status: "PENDING",
    },
    {
      folio: "BD-2026-00013",
      client_name: "Luis Pérez",
      request_date: "2026-10-05T16:40:00-06:00",
      event_date: "2026-12-02",
      status: "APPROVED",
    },
  ],
  chart: { type: "bar", x_label: "Día", y_label: "Solicitudes", buckets: [], note: null },
};

async function reopen(buffer) {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer);

  return workbook;
}

describe("writeReportWorkbook", () => {
  it("hoja única Reporte con título, filtros, generación, resumen y tabla; sin gráfica", async () => {
    const workbook = await reopen(
      await writeReportWorkbook({ report: REQUESTS_REPORT, filterLabels: {} })
    );

    expect(workbook.worksheets.map((sheet) => sheet.name)).toEqual(["Reporte"]);

    const sheet = workbook.getWorksheet("Reporte");
    expect(sheet.getCell("A1").value).toBe("Solicitudes de reservación recibidas");
    expect(sheet.getCell("A3").value).toBe("Periodo: Mes 2026-10");
    expect(sheet.getCell("A4").value).toBe("Cliente: Todos los clientes");
    expect(sheet.getCell("A5").value).toBe("Generado: 2026-10-25 22:30");
    expect(sheet.getCell("A6").value).toBe("Total: 2 solicitudes");
    expect(sheet.getCell("A8").value).toBe("Folio");
    expect(sheet.getCell("E8").value).toBe("Estado");
    expect(sheet.getCell("A9").value).toBe("BD-2026-00012");
    expect(sheet.getCell("C9").value).toBe("2026-10-03");
    expect(sheet.getCell("D10").value).toBe("2026-12-02");

    // El archivo no incluye gráfica (RF-1.2.15.7.3).
    expect(sheet.getImages()).toEqual([]);
  });

  it("filtra por cliente y por ids con etiquetas legibles cuando el writer las recibe", async () => {
    const report = {
      ...REQUESTS_REPORT,
      type: "EVENTS",
      title: "Eventos realizados por periodo",
      filters: {
        period_type: "RANGE",
        from: "2026-01-01",
        to: "2026-03-01",
        client_email: "ana@x.co",
        service_id: 7,
        promotion_id: 3,
      },
      summary: { total: 1 },
      table: [
        {
          folio: "BD-2026-00001",
          client_name: "Ana López",
          event_date: "2026-02-10",
          services: ["Banquetes", "Música"],
          promotion: { name: "Verano", status: "INACTIVE" },
        },
      ],
      chart: null,
    };

    const sheet = (
      await reopen(
        await writeReportWorkbook({
          report,
          filterLabels: { service: "Fotografía", promotion: "Verano" },
        })
      )
    ).getWorksheet("Reporte");

    expect(sheet.getCell("A3").value).toBe("Periodo: Del 2026-01-01 al 2026-03-01");
    expect(sheet.getCell("A4").value).toBe("Cliente: ana@x.co");
    expect(sheet.getCell("A5").value).toBe("Servicio: Fotografía");
    expect(sheet.getCell("A6").value).toBe("Promoción: Verano");
    expect(sheet.getCell("A7").value).toBe("Generado: 2026-10-25 22:30");
    expect(sheet.getCell("A8").value).toBe("Total: 1 eventos");
    expect(sheet.getCell("D11").value).toBe("Banquetes, Música");
    expect(sheet.getCell("E11").value).toBe("Verano");
  });

  it("porcentajes con formato de 2 decimales y resumen de contrataciones", async () => {
    const report = {
      type: "SERVICES",
      title: "Servicios contratados más frecuentes",
      filters: { period_type: "NONE", client_email: null, service_id: null },
      generated_at: "2026-11-01T09:00:00-06:00",
      summary: { total: 30 },
      table: [
        {
          service_id: 1,
          name: "Banquetes",
          status: "ACTIVE",
          times_contracted: 10,
          percentage: 33.33,
        },
        {
          service_id: 7,
          name: "Decoración (No vigente)",
          status: "INACTIVE",
          times_contracted: 5,
          percentage: 16.67,
        },
      ],
      chart: null,
    };

    const sheet = (
      await reopen(await writeReportWorkbook({ report, filterLabels: {} }))
    ).getWorksheet("Reporte");

    expect(sheet.getCell("A7").value).toBe("Total: 30 contrataciones");
    expect(sheet.getCell("C9").value).toBe("Veces contratado");
    expect(sheet.getCell("D10").value).toBe(33.33);
    expect(sheet.getCell("D10").numFmt).toBe("0.00");
    expect(sheet.getCell("A11").value).toBe("Decoración (No vigente)");
  });
});
