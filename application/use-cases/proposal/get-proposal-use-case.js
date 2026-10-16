const {
  ProposalVisibleReservationRequestStatuses,
} = require("../../../domain/enums/reservation-request/request-status");
const ProposalNotFoundException = require("../../../domain/exceptions/proposal/proposal-not-found-exception");
const { ProposalResponseDto } = require("../../dto/proposal/proposal-response-dto");
const { findOwnedRequest } = require("../../services/proposal/request-ownership");

// Función 3.4 - RF-2.3.4.6: consulta de la propuesta generada desde la ficha de
// la solicitud en estados "Propuesta generada", "Confirmado" y "Finalizado".
class GetProposalUseCase {
  constructor(reservationRequestRepository, proposalRepository) {
    this.reservationRequestRepository = reservationRequestRepository;
    this.proposalRepository = proposalRepository;
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

    return new ProposalResponseDto(proposal, requestId);
  }
}

module.exports = { GetProposalUseCase };
