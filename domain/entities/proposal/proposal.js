// DAD 010 §7.3: propuesta formal enviada al cliente para su revisión.
// Incremento 3: versionamiento por solicitud (RF-3.4.4.1), primera visualización
// (RF-3.4.4.2), aceptación con PDF inalterable (RF-3.4.4.4.3) e importes congelados
// al generar (RF-3.4.4.3). Los campos nuevos viajan en `details` para conservar la
// compatibilidad con las llamadas del incremento 2.
class Proposal {
  constructor(
    id,
    derivedInformationId,
    proposalsCode,
    name,
    creationDate,
    status,
    clientObservations,
    createdByUserId,
    createdAt,
    details = {}
  ) {
    this.id = id;
    this.derivedInformationId = derivedInformationId;
    this.proposalsCode = proposalsCode;
    this.name = name;
    this.creationDate = creationDate;
    this.status = status;
    this.clientObservations = clientObservations ?? null;
    this.createdByUserId = createdByUserId ?? null;
    this.createdAt = createdAt ?? null;
    this.requestId = details.requestId ?? null;
    this.version = details.version ?? 1;
    this.viewedAt = details.viewedAt ?? null;
    this.acceptedAt = details.acceptedAt ?? null;
    this.acceptedPdfPath = details.acceptedPdfPath ?? null;
    this.pdfPath = details.pdfPath ?? null;
    this.subtotal = details.subtotal ?? null;
    this.discountAmount = details.discountAmount ?? 0;
    this.totalAmount = details.totalAmount ?? null;
    this.currency = details.currency ?? "MXN";
  }

  // RF-3.4.4.4.6: la etiqueta visible para el cliente tras aceptar es "Aprobada".
  isAccepted() {
    return this.status === "accepted";
  }

  isAwaitingClient() {
    return this.status === "in_review";
  }
}

module.exports = { Proposal };
