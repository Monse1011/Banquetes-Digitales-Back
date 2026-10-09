const {
  ProposalVisibleReservationRequestStatuses,
} = require("../../../domain/enums/reservation-request/request-status");
const ProposalGenerationFailedException = require("../../../domain/exceptions/proposal/proposal-generation-failed-exception");
const ProposalNotFoundException = require("../../../domain/exceptions/proposal/proposal-not-found-exception");
const { ProposalMessages } = require("../../../domain/constants/proposal-messages");
const { findOwnedRequest } = require("../../services/proposal/request-ownership");

// Función 3.4 - RF-2.3.4.6: descarga del PDF almacenado (inmutable).
class DownloadProposalUseCase {
  constructor(reservationRequestRepository, proposalRepository, pdfGenerator) {
    this.reservationRequestRepository = reservationRequestRepository;
    this.proposalRepository = proposalRepository;
    this.pdfGenerator = pdfGenerator;
  }

  async execute(requestId, userId) {
    const request = await findOwnedRequest(this.reservationRequestRepository, requestId, userId);

    if (!ProposalVisibleReservationRequestStatuses.includes(request.status)) {
      throw new ProposalNotFoundException();
    }

    const proposal = await this.proposalRepository.findByRequestId(requestId);

    if (!proposal) {
      throw new ProposalNotFoundException();
    }

    let buffer;

    try {
      buffer = await this.pdfGenerator.read(proposal.name);
    } catch {
      throw new ProposalGenerationFailedException(ProposalMessages.PROPOSAL_FILE_MISSING);
    }

    return { fileName: proposal.name, buffer };
  }
}

module.exports = { DownloadProposalUseCase };
