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

  async createWithRequestStatus(proposal, requestId, expectedStatuses) {
    if (this.reservationRequestRepository) {
      const request = await this.reservationRequestRepository.findById(requestId);

      if (!request || !expectedStatuses.includes(request.status)) {
        return null;
      }

      request.status = ReservationRequestStatus.PROPOSAL_GENERATED;
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
      new Date()
    );

    this.proposals.push(created);

    return created;
  }

  async findByRequestId(requestId) {
    if (!this.derivedInformationRepository) {
      return null;
    }

    const information = await this.derivedInformationRepository.findLatestByRequestId(requestId);

    if (!information) {
      return null;
    }

    const ofRequest = this.proposals.filter(
      (proposal) => proposal.derivedInformationId === information.id
    );

    return ofRequest.length > 0 ? ofRequest[ofRequest.length - 1] : null;
  }
}

module.exports = { InMemoryProposalRepository };
