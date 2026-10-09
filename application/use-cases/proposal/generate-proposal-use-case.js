const {
  AgreementsEditableReservationRequestStatuses,
  ProposalVisibleReservationRequestStatuses,
  ReservationRequestStatus,
} = require("../../../domain/enums/reservation-request/request-status");
const { ProposalStatus } = require("../../../domain/enums/proposal/proposal-status");
const { Proposal } = require("../../../domain/entities/proposal/proposal");
const AgreementsValidationException = require("../../../domain/exceptions/proposal/agreements-validation-exception");
const DerivedInformationNotFoundException = require("../../../domain/exceptions/proposal/derived-information-not-found-exception");
const ProposalAlreadyGeneratedException = require("../../../domain/exceptions/proposal/proposal-already-generated-exception");
const ProposalGenerationFailedException = require("../../../domain/exceptions/proposal/proposal-generation-failed-exception");
const ProposalGenerationNotAllowedException = require("../../../domain/exceptions/proposal/proposal-generation-not-allowed-exception");
const RequestNotInAgreementsStateException = require("../../../domain/exceptions/proposal/request-not-in-agreements-state-exception");
const {
  ProposalFieldNames,
  ProposalMessages,
  requiredFieldMessage,
} = require("../../../domain/constants/proposal-messages");
const {
  GenerateProposalResponseDto,
} = require("../../dto/proposal/generate-proposal-response-dto");
const { findOwnedRequest } = require("../../services/proposal/request-ownership");
const { buildProposalFileName } = require("../../services/proposal/proposal-file-name");

// Función 3.4 - RF-2.3.4.4 / RF-2.3.4.5: generación del PDF de propuesta y cambio
// de estado a "Propuesta generada" en una sola operación.
class GenerateProposalUseCase {
  constructor(
    reservationRequestRepository,
    clientRepository,
    derivedInformationRepository,
    proposalRepository,
    assignedResourceRepository,
    pdfGenerator
  ) {
    this.reservationRequestRepository = reservationRequestRepository;
    this.clientRepository = clientRepository;
    this.derivedInformationRepository = derivedInformationRepository;
    this.proposalRepository = proposalRepository;
    this.assignedResourceRepository = assignedResourceRepository;
    this.pdfGenerator = pdfGenerator;
  }

  async execute(requestId, userId, dto) {
    this.validateDto(dto);

    const request = await findOwnedRequest(this.reservationRequestRepository, requestId, userId);

    this.validateState(request);

    const information = await this.derivedInformationRepository.findByIdAndRequestId(
      Number(dto.derivedInformationId),
      requestId
    );

    if (!information) {
      throw new DerivedInformationNotFoundException();
    }

    // RF-2.3.4.3: el documento no se genera con campos obligatorios vacíos.
    const informationErrors = this.validateInformation(information);

    if (Object.keys(informationErrors).length > 0) {
      throw new AgreementsValidationException(informationErrors);
    }

    const { proposalsCode, fileName } = await this.renderDocument(dto, request, information);
    const created = await this.proposalRepository.createWithRequestStatus(
      new Proposal(
        null,
        information.id,
        proposalsCode,
        fileName,
        new Date(),
        ProposalStatus.IN_REVIEW,
        dto.clientObservations ?? null,
        userId,
        null
      ),
      requestId,
      AgreementsEditableReservationRequestStatuses
    );

    // El estado cambió entre la validación y el registro: no hay propuesta duplicada.
    if (!created) {
      throw new RequestNotInAgreementsStateException();
    }

    return new GenerateProposalResponseDto(created, ReservationRequestStatus.PROPOSAL_GENERATED);
  }

  validateDto(dto) {
    const errors = dto.validate();

    if (Object.keys(errors).length > 0) {
      throw new AgreementsValidationException(errors);
    }
  }

  // RF-2.3.4.12: el PDF generado es inmutable y no se regenera.
  validateState(request) {
    if (ProposalVisibleReservationRequestStatuses.includes(request.status)) {
      throw new ProposalAlreadyGeneratedException();
    }

    if (!AgreementsEditableReservationRequestStatuses.includes(request.status)) {
      throw new ProposalGenerationNotAllowedException();
    }
  }

  // RF-2.3.4.4 / RF-2.3.4.5: el PDF se genera y almacena antes de tocar la base
  // de datos; si falla, el estado de la solicitud no cambia.
  async renderDocument(dto, request, information) {
    const client = await this.clientRepository.findById(request.clientId);
    const assignedResources = await this.assignedResourceRepository.findActiveByRequestId(
      request.requestId
    );
    const proposalsCode = await this.proposalRepository.nextProposalCode();
    const fileName = buildProposalFileName(
      client?.fullName ?? "",
      information.startDatetime,
      request.folio
    );

    try {
      const document = await this.pdfGenerator.generate({
        proposalsCode,
        fileName,
        client,
        request,
        information,
        resources: assignedResources,
        clientObservations: dto.clientObservations ?? null,
      });

      await this.pdfGenerator.store(fileName, document.buffer);

      return { proposalsCode, fileName };
    } catch (error) {
      if (error instanceof ProposalGenerationFailedException) {
        throw error;
      }

      throw new ProposalGenerationFailedException();
    }
  }

  validateInformation(information) {
    const errors = {};

    if (!information.location || information.location.trim() === "") {
      errors.location = requiredFieldMessage(ProposalFieldNames.LOCATION);
    }

    if (!information.startDatetime) {
      errors.start_datetime = requiredFieldMessage(ProposalFieldNames.START_DATETIME);
    }

    if (!information.endDatetime) {
      errors.end_datetime = requiredFieldMessage(ProposalFieldNames.END_DATETIME);
    }

    if (
      information.startDatetime &&
      information.endDatetime &&
      information.endDatetime <= information.startDatetime
    ) {
      errors.end_datetime = ProposalMessages.END_BEFORE_START;
    }

    return errors;
  }
}

module.exports = { GenerateProposalUseCase };
