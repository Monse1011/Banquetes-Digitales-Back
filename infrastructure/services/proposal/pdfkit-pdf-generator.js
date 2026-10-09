const fs = require("fs");
const path = require("path");
const PDFDocument = require("pdfkit");
const {
  formatDate,
  formatTime,
} = require("../../../application/services/reservation-request/date-time-formatter");

const COMPANY_NAME = "Banquetes Elegancia";
const ACCEPTANCE_CLAUSES = [
  "La presente propuesta tiene una vigencia de 15 días naturales a partir de su fecha de emisión.",
  "La aceptación de la propuesta confirma el horario, la ubicación y los recursos desglosados.",
  "Cualquier ajuste posterior a la aceptación deberá acordarse por escrito con la empresa.",
];

// RF-2.3.4.4: documento PDF con encabezado institucional, datos del cliente,
// folio, fecha/hora, ubicación, desglose de recursos con costos unitarios,
// promociones aplicadas, total a pagar y cláusulas de aceptación.
class PdfkitPdfGenerator {
  constructor({ storageDir } = {}) {
    this.storageDir = storageDir;
  }

  async generate({
    fileName,
    proposalsCode,
    client,
    request,
    information,
    resources,
    clientObservations,
  }) {
    const buffer = await new Promise((resolve, reject) => {
      const document = new PDFDocument({ size: "Letter", margin: 50 });
      const chunks = [];

      document.on("data", (chunk) => chunks.push(chunk));
      document.on("end", () => resolve(Buffer.concat(chunks)));
      document.on("error", reject);

      this.renderHeader(document, proposalsCode);
      this.renderClient(document, client);
      this.renderEvent(document, request, information);
      this.renderResources(document, resources);
      this.renderTotal(document, resources);
      this.renderObservations(document, clientObservations);
      this.renderClauses(document);

      document.end();
    });

    return { fileName, buffer };
  }

  async store(fileName, buffer) {
    await fs.promises.mkdir(this.storageDir, { recursive: true });
    await fs.promises.writeFile(path.join(this.storageDir, fileName), buffer);
  }

  async read(fileName) {
    return fs.promises.readFile(path.join(this.storageDir, fileName));
  }

  renderHeader(document, proposalsCode) {
    document
      .fontSize(18)
      .text(COMPANY_NAME, { align: "center" })
      .fontSize(12)
      .text(`Propuesta formal de evento - ${proposalsCode}`, { align: "center" })
      .text(`Fecha de emisión: ${formatDate(new Date())} ${formatTime(new Date())}`, {
        align: "center",
      })
      .moveDown(2);
  }

  renderClient(document, client) {
    document
      .fontSize(14)
      .text("Datos del cliente")
      .fontSize(10)
      .text(`Nombre: ${client?.fullName ?? "Sin registrar"}`)
      .text(`Correo: ${client?.email ?? "Sin registrar"}`)
      .text(`Teléfono: ${client?.phone || "Sin registrar"}`)
      .moveDown(1);
  }

  renderEvent(document, request, information) {
    document
      .fontSize(14)
      .text("Datos del evento")
      .fontSize(10)
      .text(`Folio de la solicitud: ${request.folio}`)
      .text(`Ubicación: ${information.location}`)
      .text(
        `Horario confirmado: ${formatDate(information.startDatetime)} ` +
          `${formatTime(information.startDatetime)} a ${formatTime(information.endDatetime)}`
      )
      .text(`Número de invitados: ${request.guestCount}`)
      .moveDown(1);
  }

  renderResources(document, resources) {
    document.fontSize(14).text("Desglose de recursos").moveDown(0.5);

    if (resources.length === 0) {
      document.fontSize(10).text("Sin recursos asignados.").moveDown(1);
      return;
    }

    document.fontSize(10);
    resources.forEach((resource) => {
      const subtotal = resource.quantity * (resource.unitCost ?? 0);

      document.text(
        `${resource.name} (${resource.type}): ${resource.quantity} x ` +
          `$${(resource.unitCost ?? 0).toFixed(2)} = $${subtotal.toFixed(2)}`
      );
    });

    document.moveDown(1);
  }

  renderTotal(document, resources) {
    const total = resources.reduce(
      (amount, resource) => amount + resource.quantity * (resource.unitCost ?? 0),
      0
    );

    document
      .fontSize(10)
      .text("Promociones aplicadas: sin promociones aplicadas.")
      .fontSize(12)
      .text(`Total a pagar: $${total.toFixed(2)}`)
      .moveDown(1);
  }

  renderObservations(document, clientObservations) {
    if (!clientObservations) {
      return;
    }

    document
      .fontSize(14)
      .text("Observaciones del cliente")
      .fontSize(10)
      .text(clientObservations)
      .moveDown(1);
  }

  renderClauses(document) {
    document.fontSize(14).text("Cláusulas de aceptación").moveDown(0.5);
    document.fontSize(10);
    ACCEPTANCE_CLAUSES.forEach((clause, index) => {
      document.text(`${index + 1}. ${clause}`);
    });
  }
}

module.exports = { PdfkitPdfGenerator };
