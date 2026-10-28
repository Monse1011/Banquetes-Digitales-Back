const { Proposal } = require("../../../domain/entities/proposal/proposal");
const {
  ReservationRequestStatus,
} = require("../../../domain/enums/reservation-request/request-status");

// Réplica en memoria de PostgresProposalRepository para pruebas.
class InMemoryProposalRepository {
  constructor(reservationRequestRepository = null, derivedInformationRepository = null) {
    this.reservationRequestRepository = reservationRequestRepository;
    this.derivedInformationRepository = derivedInformationRepository;
    this.proposals = [];
    this.resources = [];
    this.nextId = 1;
  }

  async nextProposalCode() {
    const year = new Date().getFullYear();
    const prefix = `PROP-${year}-`;
    const sequences = this.proposals
      .filter((proposal) => proposal.proposalsCode.startsWith(prefix))
      .map((proposal) => Number(proposal.proposalsCode.slice(prefix.length)))
      .filter((sequence) => Number.isInteger(sequence));
    const next = sequences.length > 0 ? Math.max(...sequences) + 1 : 1;

    return `${prefix}${String(next).padStart(4, "0")}`;
  }

  async nextVersion(requestId) {
    const versions = this.proposals
      .filter((proposal) => proposal.requestId === requestId)
      .map((proposal) => proposal.version);

    return versions.length > 0 ? Math.max(...versions) + 1 : 1;
  }

  async createWithRequestStatus(proposal, requestId, expectedStatuses, resources = []) {
    if (this.reservationRequestRepository) {
      const request = await this.reservationRequestRepository.findById(requestId);

      if (!request || !expectedStatuses.includes(request.status)) {
        return null;
      }

      request.status = ReservationRequestStatus.PROPOSAL_GENERATED;
      request.statusChangedAt = new Date();
    }

    const created = new Proposal(
      this.nextId++,
      proposal.derivedInformationId,
      proposal.proposalsCode,
      proposal.name,
      proposal.creationDate,
      proposal.status,
      proposal.clientObservations,
      proposal.createdByUserId,
      new Date(),
      {
        requestId,
        version: await this.nextVersion(requestId),
        subtotal: proposal.subtotal ?? null,
        discountAmount: proposal.discountAmount ?? 0,
        totalAmount: proposal.totalAmount ?? null,
        currency: proposal.currency ?? "MXN",
        pdfPath: proposal.name,
      }
    );

    this.proposals.push(created);
    resources.forEach((resource) => this.resources.push({ proposalId: created.id, ...resource }));

    return created;
  }

  async findByRequestId(requestId) {
    return this.findCurrentByRequestId(requestId);
  }

  // Versión de mayor número = propuesta vigente (RF-3.4.4.1).
  async findCurrentByRequestId(requestId) {
    const byRequest = this.proposals.filter((proposal) => proposal.requestId === requestId);
    const candidates =
      byRequest.length > 0 ? byRequest : await this.byRequestViaInformation(requestId);

    if (candidates.length === 0) {
      return null;
    }

    return candidates.reduce((current, candidate) =>
      (candidate.version ?? 1) > (current.version ?? 1) ? candidate : current
    );
  }

  // Compatibilidad con propuestas creadas sin request_id (incremento 2): se enlazan a
  // través de la información derivada más reciente de la solicitud.
  async byRequestViaInformation(requestId) {
    if (!this.derivedInformationRepository) {
      return [];
    }

    const information = await this.derivedInformationRepository.findLatestByRequestId(requestId);

    if (!information) {
      return [];
    }

    return this.proposals.filter((proposal) => proposal.derivedInformationId === information.id);
  }

  async findResourcesByProposalId(proposalId) {
    return this.resources.filter((resource) => resource.proposalId === proposalId);
  }

  // RF-3.4.4.2: viewed_at se escribe una sola vez.
  async markViewed(proposalId, viewedAt) {
    const proposal = this.proposals.find((candidate) => candidate.id === proposalId);

    if (!proposal || proposal.viewedAt) {
      return false;
    }

    proposal.viewedAt = viewedAt;

    return true;
  }

  // RF-3.4.4.4.2 / 4.4.4.6: la etiqueta "Aprobada" = propuesta ACCEPTED con PDF inalterable.
  async markAccepted(proposalId, acceptedAt, acceptedPdfPath) {
    const proposal = this.proposals.find((candidate) => candidate.id === proposalId);

    if (!proposal || proposal.status !== "in_review") {
      return false;
    }

    proposal.status = "accepted";
    proposal.acceptedAt = acceptedAt;
    proposal.acceptedPdfPath = acceptedPdfPath;

    return true;
  }

  async updateStatusAtomic(proposalId, expectedStatus, newStatus) {
    const proposal = this.proposals.find((candidate) => candidate.id === proposalId);

    if (!proposal || proposal.status !== expectedStatus) {
      return false;
    }

    proposal.status = newStatus;

    return true;
  }
}

module.exports = { InMemoryProposalRepository };
