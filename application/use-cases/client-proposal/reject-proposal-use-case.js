const ClientRequestNotFoundException = require("../../../domain/exceptions/client-proposal/client-request-not-found-exception");
const InvalidFolioFormatException = require("../../../domain/exceptions/client-proposal/invalid-folio-format-exception");
const ClientProposalNotAvailableException = require("../../../domain/exceptions/client-proposal/client-proposal-not-available-exception");
const ProposalActionConflictException = require("../../../domain/exceptions/client-proposal/proposal-action-conflict-exception");
const ProposalNotFoundException = require("../../../domain/exceptions/proposal/proposal-not-found-exception");
const { isValidFolio, normalizeFolio } = require("../../../domain/value-objects/folio");
const {
  ReservationRequestStatus,
} = require("../../../domain/enums/reservation-request/request-status");
const { ProposalStatus } = require("../../../domain/enums/proposal/proposal-status");
const { ClientProposalMessages } = require("../../../domain/constants/client-proposal-messages");
const {
  RejectProposalResponseDto,
} = require("../../dto/client-proposal/reject-proposal-response-dto");

// Función 4.4 (RF-3.4.4.6.4 a RF-3.4.4.6.6): el cliente rechaza la propuesta. La solicitud
// y la propuesta vigente pasan a "Rechazada" y se liberan los recursos asignados. No hay
// evento de calendario que cancelar porque el evento se crea al aceptar.
class RejectProposalUseCase {
  constructor(
    reservationRequestRepository,
    proposalRepository,
    assignedResourceRepository,
    transactionManager = null
  ) {
    this.reservationRequestRepository = reservationRequestRepository;
    this.proposalRepository = proposalRepository;
    this.assignedResourceRepository = assignedResourceRepository;
    this.transactionManager = transactionManager;
  }

  async execute(rawFolio, now = new Date()) {
    if (!isValidFolio(rawFolio)) {
      throw new InvalidFolioFormatException();
    }

    const request = await this.reservationRequestRepository.findByFolio(normalizeFolio(rawFolio));

    if (!request) {
      throw new ClientRequestNotFoundException();
    }

    if (request.status !== ReservationRequestStatus.IN_REVIEW) {
      throw new ClientProposalNotAvailableException(
        ClientProposalMessages.NOT_AVAILABLE_FOR_REJECTION
      );
    }

    const proposal = await this.proposalRepository.findCurrentByRequestId(request.requestId);

    if (!proposal) {
      throw new ProposalNotFoundException();
    }

    return this.commitRejection(request, proposal, now);
  }

  async commitRejection(request, proposal, now) {
    const apply = async (transaction) => {
      const changed = await this.reservationRequestRepository.changeStatusAtomic(
        request.requestId,
        {
          fromStatus: ReservationRequestStatus.IN_REVIEW,
          toStatus: ReservationRequestStatus.REJECTED,
          changedByUserId: null,
          changedAt: now,
          transaction,
        }
      );

      if (!changed) {
        throw new ProposalActionConflictException(
          ClientProposalMessages.NOT_AVAILABLE_FOR_REJECTION
        );
      }

      await this.proposalRepository.updateStatusAtomic(
        proposal.id,
        ProposalStatus.IN_REVIEW,
        ProposalStatus.REJECTED,
        transaction
      );

      // RF-3.4.4.6: se retira el bloqueo de disponibilidad del responsable y los recursos.
      await this.assignedResourceRepository.releaseByRequestId(request.requestId, transaction);

      return new RejectProposalResponseDto({
        request: changed,
        previousStatus: ReservationRequestStatus.IN_REVIEW,
      });
    };

    return this.transactionManager ? this.transactionManager.run(apply) : apply(null);
  }
}

module.exports = { RejectProposalUseCase };
