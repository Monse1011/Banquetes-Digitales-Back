const {
  AgreementsEditableReservationRequestStatuses,
  ReservationRequestStatus,
} = require("../../../domain/enums/reservation-request/request-status");
const {
  RequestAgreementsResponseDto,
} = require("../../dto/proposal/request-agreements-response-dto");
const { findOwnedRequest } = require("../../services/proposal/request-ownership");
const { withAgreementsLock } = require("../../services/proposal/with-agreements-lock");

// Función 3.4 - RF-2.3.4.1 / RF-2.3.4.2: datos de contacto del cliente, horario
// vigente y recursos asignados para precargar el formulario de acuerdos.
class GetRequestAgreementsUseCase {
  constructor(
    reservationRequestRepository,
    clientRepository,
    assignedResourceRepository,
    derivedInformationRepository,
    resourceConfirmationRepository = null,
    transactionManager = null
  ) {
    this.reservationRequestRepository = reservationRequestRepository;
    this.clientRepository = clientRepository;
    this.assignedResourceRepository = assignedResourceRepository;
    this.derivedInformationRepository = derivedInformationRepository;
    this.resourceConfirmationRepository = resourceConfirmationRepository;
    this.transactionManager = transactionManager;
  }

  async execute(requestId, userId, role) {
    return withAgreementsLock(
      this.derivedInformationRepository,
      this.transactionManager,
      requestId,
      (transaction) => this.executeLocked(requestId, userId, role, transaction)
    );
  }

  async executeLocked(requestId, userId, role, transaction) {
    const request = await findOwnedRequest(
      this.reservationRequestRepository,
      requestId,
      userId,
      role,
      transaction
    );
    const client = await this.clientRepository.findById(request.clientId, transaction);
    const assignedResources = await this.assignedResourceRepository.findActiveByRequestId(
      requestId,
      transaction
    );
    const latestAgreements = await this.derivedInformationRepository.findLatestByRequestId(
      requestId,
      transaction
    );
    const confirmation = await this.resourceConfirmationRepository?.findLatestByRequest(requestId);

    const confirmedStatuses = [
      ReservationRequestStatus.CONFIRMED,
      ReservationRequestStatus.FINISHED,
    ];
    const scheduleType =
      latestAgreements || confirmedStatuses.includes(request.status) ? "confirmado" : "propuesto";

    return new RequestAgreementsResponseDto({
      request: {
        ...request,
        eventAddress: latestAgreements ? latestAgreements.location : request.eventAddress,
        eventDateTime: latestAgreements ? latestAgreements.startDatetime : request.eventDateTime,
        eventEndTime: latestAgreements ? latestAgreements.endDatetime : request.eventEndTime,
      },
      client,
      assignedResources,
      canRegisterAgreements: AgreementsEditableReservationRequestStatuses.includes(request.status),
      scheduleType,
      observations: latestAgreements?.observations ?? null,
      derivedInformationId: latestAgreements?.id ?? null,
      confirmationObservations: confirmation?.observations ?? null,
    });
  }
}

module.exports = { GetRequestAgreementsUseCase };
