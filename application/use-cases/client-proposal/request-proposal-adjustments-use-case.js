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
const { ProposalAdjustment } = require("../../../domain/entities/proposal/proposal-adjustment");
const { AdjustmentsResponseDto } = require("../../dto/client-proposal/adjustments-response-dto");

// Función 4.4 (RF-3.4.4.5.2 a RF-3.4.4.5.7): el cliente solicita ajustes. La solicitud y
// la propuesta vigente pasan a "Ajustes Solicitados" y se almacena la observación con fecha
// y hora. No modifica derived_information: los cambios estructurados los registra Logística.
class RequestProposalAdjustmentsUseCase {
  constructor(
    reservationRequestRepository,
    proposalRepository,
    proposalAdjustmentRepository,
    transactionManager = null
  ) {
    this.reservationRequestRepository = reservationRequestRepository;
    this.proposalRepository = proposalRepository;
    this.proposalAdjustmentRepository = proposalAdjustmentRepository;
    this.transactionManager = transactionManager;
  }

  async execute(rawFolio, observations, now = new Date()) {
    if (!isValidFolio(rawFolio)) {
      throw new InvalidFolioFormatException();
    }

    const request = await this.reservationRequestRepository.findByFolio(normalizeFolio(rawFolio));

    if (!request) {
      throw new ClientRequestNotFoundException();
    }

    if (request.status !== ReservationRequestStatus.IN_REVIEW) {
      throw new ClientProposalNotAvailableException(
        ClientProposalMessages.NOT_AVAILABLE_FOR_ADJUSTMENTS
      );
    }

    const proposal = await this.proposalRepository.findCurrentByRequestId(request.requestId);

    if (!proposal) {
      throw new ProposalNotFoundException();
    }

    return this.commitAdjustments(request, proposal, observations, now);
  }

  async commitAdjustments(request, proposal, observations, now) {
    const apply = async (transaction) => {
      const changed = await this.reservationRequestRepository.changeStatusAtomic(
        request.requestId,
        {
          fromStatus: ReservationRequestStatus.IN_REVIEW,
          toStatus: ReservationRequestStatus.ADJUSTMENTS_REQUESTED,
          changedByUserId: null,
          changedAt: now,
          transaction,
        }
      );

      if (!changed) {
        throw new ProposalActionConflictException(
          ClientProposalMessages.NOT_AVAILABLE_FOR_ADJUSTMENTS
        );
      }

      // Si la propuesta ya no está en IN_REVIEW se rechaza con
      // conflicto y se revierte la solicitud y la observación registrada.
      const proposalChanged = await this.proposalRepository.updateStatusAtomic(
        proposal.id,
        ProposalStatus.IN_REVIEW,
        ProposalStatus.ADJUSTMENTS_REQUESTED,
        transaction
      );

      if (!proposalChanged) {
        throw new ProposalActionConflictException(
          ClientProposalMessages.NOT_AVAILABLE_FOR_ADJUSTMENTS
        );
      }

      await this.proposalAdjustmentRepository.create(
        new ProposalAdjustment(null, proposal.id, observations, now),
        transaction
      );

      return new AdjustmentsResponseDto({
        request: changed,
        previousStatus: ReservationRequestStatus.IN_REVIEW,
        requestedAt: now,
      });
    };

    return this.transactionManager ? this.transactionManager.run(apply) : apply(null);
  }
}

module.exports = { RequestProposalAdjustmentsUseCase };
