const {
  ProposalVisibleReservationRequestStatuses,
} = require("../../../domain/enums/reservation-request/request-status");
const ProposalNotFoundException = require("../../../domain/exceptions/proposal/proposal-not-found-exception");
const ProposalSendFailedException = require("../../../domain/exceptions/proposal/proposal-send-failed-exception");
const { findOwnedRequest } = require("../../services/proposal/request-ownership");

const PROPOSAL_SENT_ACTION = "PROPOSAL_SENT";

// Función 3.4 - RF-2.3.4.6: envío de la propuesta por correo al cliente con
// registro de fecha, hora, usuario y destinatario en la bitácora.
class SendProposalUseCase {
  constructor(
    reservationRequestRepository,
    clientRepository,
    proposalRepository,
    pdfGenerator,
    emailService,
    auditLogRepository
  ) {
    this.reservationRequestRepository = reservationRequestRepository;
    this.clientRepository = clientRepository;
    this.proposalRepository = proposalRepository;
    this.pdfGenerator = pdfGenerator;
    this.emailService = emailService;
    this.auditLogRepository = auditLogRepository;
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

    const client = await this.clientRepository.findById(request.clientId);

    let buffer;

    try {
      buffer = await this.pdfGenerator.read(proposal.name);
      await this.emailService.sendProposalEmail(
        client.email,
        client.fullName,
        proposal.proposalsCode,
        proposal.name,
        buffer
      );
    } catch (error) {
      if (error instanceof ProposalSendFailedException) {
        throw error;
      }

      throw new ProposalSendFailedException();
    }

    await this.auditLogRepository.record({
      userId,
      action: PROPOSAL_SENT_ACTION,
      entityId: proposal.id,
      previousData: null,
      newData: {
        recipient: client.email,
        proposals_code: proposal.proposalsCode,
        sent_at: new Date().toISOString(),
      },
    });
  }
}

module.exports = { SendProposalUseCase };
