const {
  AgreementsEditableReservationRequestStatuses,
  ProposalAlreadyGeneratedStatuses,
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
const { withAgreementsLock } = require("../../services/proposal/with-agreements-lock");
const AgreementsRevisionChangedException = require("../../../domain/exceptions/proposal/agreements-revision-changed-exception");

function round2(value) {
  return Math.round((Number(value) + Number.EPSILON) * 100) / 100;
}

// Función 3.4 - RF-2.3.4.4 / RF-2.3.4.5: generación del PDF de propuesta y cambio
// de estado a "Propuesta generada" en una sola operación.
class GenerateProposalUseCase {
  constructor(
    reservationRequestRepository,
    clientRepository,
    derivedInformationRepository,
    proposalRepository,
    assignedResourceRepository,
    pdfGenerator,
    transactionManager = null
  ) {
    this.reservationRequestRepository = reservationRequestRepository;
    this.clientRepository = clientRepository;
    this.derivedInformationRepository = derivedInformationRepository;
    this.proposalRepository = proposalRepository;
    this.assignedResourceRepository = assignedResourceRepository;
    this.pdfGenerator = pdfGenerator;
    this.transactionManager = transactionManager;
  }

  async execute(requestId, userId, dto, role) {
    this.validateDto(dto);
    return withAgreementsLock(
      this.derivedInformationRepository,
      this.transactionManager,
      requestId,
      (transaction) => this.executeLocked(requestId, userId, dto, role, transaction)
    );
  }

  async executeLocked(requestId, userId, dto, role, transaction) {
    const request = await findOwnedRequest(
      this.reservationRequestRepository,
      requestId,
      userId,
      role,
      transaction
    );

    this.validateState(request);

    const information = await this.derivedInformationRepository.findByIdAndRequestId(
      Number(dto.derivedInformationId),
      requestId,
      transaction
    );

    if (!information) {
      throw new DerivedInformationNotFoundException();
    }

    const latest = await this.derivedInformationRepository.findLatestByRequestId(
      requestId,
      transaction
    );
    if (latest?.id !== information.id) {
      throw new AgreementsRevisionChangedException();
    }

    // RF-2.3.4.3: el documento no se genera con campos obligatorios vacíos.
    const informationErrors = this.validateInformation(information);

    if (Object.keys(informationErrors).length > 0) {
      throw new AgreementsValidationException(informationErrors);
    }

    const { proposalsCode, fileName, resources } = await this.renderDocument(
      dto,
      request,
      information,
      transaction
    );

    // Incremento 3 (RF-3.4.4.3): subtotal = Σ quantity × unit_cost congelado de las líneas;
    // discount_amount es opcional (0 por defecto) y debe estar entre 0 y el subtotal.
    const subtotal = resources.reduce(
      (sum, resource) => sum + Number(resource.quantity) * Number(resource.unitCost ?? 0),
      0
    );
    const discountAmount = this.validateDiscount(dto, subtotal);

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
        null,
        {
          subtotal: round2(subtotal),
          discountAmount: round2(discountAmount),
          totalAmount: round2(subtotal - discountAmount),
          currency: "MXN",
        }
      ),
      requestId,
      AgreementsEditableReservationRequestStatuses,
      resources,
      transaction
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

  // Contrato DAD: discount_amount opcional (default 0), numérico, 0 ≤ d ≤ subtotal.
  validateDiscount(dto, subtotal) {
    const raw = dto.discountAmount;

    if (raw === undefined || raw === null) {
      return 0;
    }

    const discount = Number(raw);

    if (!Number.isFinite(discount) || discount < 0 || round2(discount) > round2(subtotal)) {
      throw new AgreementsValidationException({
        discount_amount: "El descuento debe ser un número entre 0 y el subtotal de la propuesta.",
      });
    }

    return discount;
  }

  // RF-2.3.4.12 + Incremento 3: no se regenera sobre una propuesta vigente en revisión,
  // pero desde "Ajustes Solicitados" se permite una versión nueva.
  validateState(request) {
    if (ProposalAlreadyGeneratedStatuses.includes(request.status)) {
      throw new ProposalAlreadyGeneratedException();
    }

    if (!AgreementsEditableReservationRequestStatuses.includes(request.status)) {
      throw new ProposalGenerationNotAllowedException();
    }
  }

  // RF-2.3.4.4 / RF-2.3.4.5: el PDF se genera y almacena antes de tocar la base
  // de datos; si falla, el estado de la solicitud no cambia.
  async renderDocument(dto, request, information, transaction) {
    const client = await this.clientRepository.findById(request.clientId, transaction);
    const assignedResources = await this.assignedResourceRepository.findActiveByRequestId(
      request.requestId,
      transaction
    );
    if (assignedResources.length === 0) {
      throw new AgreementsValidationException({
        adjusted_resources: "No hay recursos confirmados disponibles para generar la propuesta.",
      });
    }
    const proposalsCode = await this.proposalRepository.nextProposalCode(transaction);
    const baseFileName = buildProposalFileName(
      client?.fullName ?? "",
      information.startDatetime,
      request.folio
    );

    const fileName = `${proposalsCode}_${baseFileName}`;
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

      return { proposalsCode, fileName, resources: assignedResources };
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
