const ClientRequestNotFoundException = require("../../../domain/exceptions/client-proposal/client-request-not-found-exception");
const InvalidFolioFormatException = require("../../../domain/exceptions/client-proposal/invalid-folio-format-exception");
const ProposalNotFoundException = require("../../../domain/exceptions/proposal/proposal-not-found-exception");
const { isValidFolio, normalizeFolio } = require("../../../domain/value-objects/folio");
const {
  ReservationRequestStatus,
} = require("../../../domain/enums/reservation-request/request-status");
const { canViewProposalDetail } = require("../../../domain/enums/client-proposal/proposal-access");
const { resolveCurrentEventData } = require("../../services/client-proposal/current-event-data");
const {
  groupProposalResources,
} = require("../../services/client-proposal/proposal-resource-groups");
const {
  ClientProposalDetailResponseDto,
} = require("../../dto/client-proposal/client-proposal-detail-response-dto");

// Función 4.4 (RF-3.4.4.1 a RF-3.4.4.3): detalle de la propuesta vigente. La primera
// visualización con la solicitud en "Propuesta generada" cambia el estado a "En revisión",
// guarda viewed_at y registra el historial, todo en una sola transacción (RF-3.4.4.2).
class GetClientProposalDetailUseCase {
  constructor(
    reservationRequestRepository,
    clientRepository,
    derivedInformationRepository,
    proposalRepository,
    transactionManager = null
  ) {
    this.reservationRequestRepository = reservationRequestRepository;
    this.clientRepository = clientRepository;
    this.derivedInformationRepository = derivedInformationRepository;
    this.proposalRepository = proposalRepository;
    this.transactionManager = transactionManager;
  }

  async execute(rawFolio, now = new Date()) {
    if (!isValidFolio(rawFolio)) {
      throw new InvalidFolioFormatException();
    }

    const request = await this.reservationRequestRepository.findByFolio(normalizeFolio(rawFolio));

    // Solo PROPOSAL_GENERATED e IN_REVIEW ofrecen el detalle; el resto responde 404
    // con el mensaje del folio (RF-3.4.4.1, RF-3.4.5.8/9).
    if (!request || !canViewProposalDetail(request.status)) {
      throw new ClientRequestNotFoundException();
    }

    const proposal = await this.proposalRepository.findCurrentByRequestId(request.requestId);

    if (!proposal) {
      throw new ProposalNotFoundException();
    }

    const updated = await this.registerFirstView(request, proposal, now);

    return this.buildResponse(updated ?? request, proposal);
  }

  // RF-3.4.4.2: idempotente. Si la solicitud ya está en revisión no vuelve a registrar.
  async registerFirstView(request, proposal, now) {
    if (request.status !== ReservationRequestStatus.PROPOSAL_GENERATED) {
      return null;
    }

    const apply = async (transaction) => {
      const changed = await this.reservationRequestRepository.changeStatusAtomic(
        request.requestId,
        {
          fromStatus: ReservationRequestStatus.PROPOSAL_GENERATED,
          toStatus: ReservationRequestStatus.IN_REVIEW,
          changedByUserId: null,
          changedAt: now,
          transaction,
        }
      );

      if (!changed) {
        // Otra primera visualización ganó la transición. Se
        // re-consulta la solicitud para responder con el estado persistido actual,
        // nunca con la copia obsoleta leída antes de la carrera.
        const current = await this.reservationRequestRepository.findById(request.requestId);

        return current ?? request;
      }

      await this.proposalRepository.markViewed(proposal.id, now, transaction);

      return changed;
    };

    return this.transactionManager ? this.transactionManager.run(apply) : apply(null);
  }

  async buildResponse(request, proposal) {
    const information = await this.derivedInformationRepository.findByIdAndRequestId(
      proposal.derivedInformationId,
      request.requestId
    );
    const client = await this.clientRepository.findById(request.clientId);
    const resourceLines = await this.proposalRepository.findResourcesByProposalId(proposal.id);

    return new ClientProposalDetailResponseDto({
      request,
      proposal,
      client,
      eventData: resolveCurrentEventData(request, information),
      resources: groupProposalResources(resourceLines),
    });
  }
}

module.exports = { GetClientProposalDetailUseCase };
