const { randomUUID } = require("crypto");
const ClientRequestNotFoundException = require("../../../domain/exceptions/client-proposal/client-request-not-found-exception");
const InvalidFolioFormatException = require("../../../domain/exceptions/client-proposal/invalid-folio-format-exception");
const ClientProposalNotAvailableException = require("../../../domain/exceptions/client-proposal/client-proposal-not-available-exception");
const ProposalActionConflictException = require("../../../domain/exceptions/client-proposal/proposal-action-conflict-exception");
const ProposalAcceptanceConflictException = require("../../../domain/exceptions/client-proposal/proposal-acceptance-conflict-exception");
const ProposalAcceptanceFailedException = require("../../../domain/exceptions/client-proposal/proposal-acceptance-failed-exception");
const ProposalNotFoundException = require("../../../domain/exceptions/proposal/proposal-not-found-exception");
const { isValidFolio, normalizeFolio } = require("../../../domain/value-objects/folio");
const {
  ReservationRequestStatus,
} = require("../../../domain/enums/reservation-request/request-status");
const { ProposalStatus } = require("../../../domain/enums/proposal/proposal-status");
const { ClientProposalMessages } = require("../../../domain/constants/client-proposal-messages");
const {
  groupProposalResources,
} = require("../../services/client-proposal/proposal-resource-groups");
const { buildAcceptedProposalFileName } = require("../../services/proposal/proposal-file-name");
const {
  AcceptProposalResponseDto,
} = require("../../dto/client-proposal/accept-proposal-response-dto");

// Función 4.4 (RF-3.4.4.4.2 a RF-3.4.4.4.6): el cliente acepta la propuesta. En una sola
// transacción la solicitud pasa a "Confirmado", la propuesta a "Aceptada" con su PDF
// inalterable, se revalida disponibilidad y se agenda el evento (Función 3.3).
class AcceptProposalUseCase {
  constructor(
    reservationRequestRepository,
    clientRepository,
    derivedInformationRepository,
    proposalRepository,
    pdfGenerator,
    acceptanceScheduler,
    transactionManager = null
  ) {
    this.reservationRequestRepository = reservationRequestRepository;
    this.clientRepository = clientRepository;
    this.derivedInformationRepository = derivedInformationRepository;
    this.proposalRepository = proposalRepository;
    this.pdfGenerator = pdfGenerator;
    this.acceptanceScheduler = acceptanceScheduler;
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
        ClientProposalMessages.NOT_AVAILABLE_FOR_ACCEPTANCE
      );
    }

    const proposal = await this.proposalRepository.findCurrentByRequestId(request.requestId);

    if (!proposal) {
      throw new ProposalNotFoundException();
    }

    const pdf = await this.renderAcceptedPdf(request, proposal);

    try {
      const response = await this.commitAcceptance(request, proposal, pdf.fileName, now);

      // Se publica solo si la aceptación se confirmó, y nunca se
      // sustituye un PDF ya aceptado. Si algo falla, se limpia el archivo temporal.
      await this.publishAcceptedPdf(pdf);

      return response;
    } catch (error) {
      await this.discardPdf(pdf);
      throw error;
    }
  }

  // RF-3.4.4.4.3: el PDF de aceptación se genera con la misma fuente que el detalle.
  // Se escribe en un temporal único; el nombre definitivo queda reservado para
  // la publicación atómica posterior a la confirmación de la aceptación.
  async renderAcceptedPdf(request, proposal) {
    const information = await this.derivedInformationRepository.findByIdAndRequestId(
      proposal.derivedInformationId,
      request.requestId
    );
    const client = await this.clientRepository.findById(request.clientId);
    const resourceLines = await this.proposalRepository.findResourcesByProposalId(proposal.id);
    const fileName = buildAcceptedProposalFileName(
      client?.fullName ?? "",
      information?.startDatetime ?? request.eventDateTime,
      request.folio
    );
    const tempFileName = `${fileName}.${randomUUID()}.tmp`;

    try {
      const document = await this.pdfGenerator.generateAccepted({
        fileName,
        proposal,
        client,
        request,
        information,
        resources: groupProposalResources(resourceLines),
      });

      await this.pdfGenerator.storeTemp(tempFileName, document.buffer);

      return { fileName, tempFileName };
    } catch (error) {
      await this.discardPdf({ tempFileName });

      if (error instanceof ProposalAcceptanceFailedException) {
        throw error;
      }

      throw new ProposalAcceptanceFailedException();
    }
  }

  async publishAcceptedPdf(pdf) {
    try {
      await this.pdfGenerator.publishAccepted(pdf.tempFileName, pdf.fileName);
    } catch (error) {
      if (error instanceof ProposalAcceptanceFailedException) {
        throw error;
      }

      throw new ProposalAcceptanceFailedException();
    }
  }

  async discardPdf(pdf) {
    try {
      await this.pdfGenerator.discardTemp?.(pdf.tempFileName);
    } catch {
      // La limpieza del temporal no debe enmascarar el error de aceptación.
    }
  }

  async commitAcceptance(request, proposal, fileName, now) {
    const apply = async (transaction) => {
      // RF-2.3.3.1: revalida disponibilidad sin contar la propia solicitud.
      const scheduled = await this.acceptanceScheduler.scheduleForAcceptance(request.requestId, {
        now,
        transaction,
      });

      if (scheduled.status === "unavailable") {
        const conflict = new ProposalAcceptanceConflictException();
        conflict.conflicts = scheduled.conflicts ?? [];
        throw conflict;
      }

      if (scheduled.status === "not_found") {
        throw new ClientRequestNotFoundException();
      }

      const changed = await this.reservationRequestRepository.changeStatusAtomic(
        request.requestId,
        {
          fromStatus: ReservationRequestStatus.IN_REVIEW,
          toStatus: ReservationRequestStatus.CONFIRMED,
          changedByUserId: null,
          changedAt: now,
          transaction,
        }
      );

      if (!changed) {
        throw new ProposalActionConflictException(
          ClientProposalMessages.NOT_AVAILABLE_FOR_ACCEPTANCE
        );
      }

      const accepted = await this.proposalRepository.markAccepted(
        proposal.id,
        now,
        fileName,
        transaction
      );

      if (!accepted) {
        throw new ProposalActionConflictException(
          ClientProposalMessages.NOT_AVAILABLE_FOR_ACCEPTANCE
        );
      }

      return new AcceptProposalResponseDto({
        request: changed,
        proposal: { ...proposal, status: ProposalStatus.ACCEPTED },
        previousStatus: ReservationRequestStatus.IN_REVIEW,
        acceptedAt: now,
      });
    };

    return this.transactionManager ? this.transactionManager.run(apply) : apply(null);
  }
}

module.exports = { AcceptProposalUseCase };
