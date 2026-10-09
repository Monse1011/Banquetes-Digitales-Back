const {
  AgreementsEditableReservationRequestStatuses,
  ReservationRequestStatus,
} = require("../../../domain/enums/reservation-request/request-status");
const {
  RequestAgreementsResponseDto,
} = require("../../dto/proposal/request-agreements-response-dto");
const { findOwnedRequest } = require("../../services/proposal/request-ownership");

// Función 3.4 - RF-2.3.4.1 / RF-2.3.4.2: datos de contacto del cliente, horario
// vigente y recursos asignados para precargar el formulario de acuerdos.
class GetRequestAgreementsUseCase {
  constructor(
    reservationRequestRepository,
    clientRepository,
    assignedResourceRepository,
    derivedInformationRepository
  ) {
    this.reservationRequestRepository = reservationRequestRepository;
    this.clientRepository = clientRepository;
    this.assignedResourceRepository = assignedResourceRepository;
    this.derivedInformationRepository = derivedInformationRepository;
  }

  async execute(requestId, userId) {
    const request = await findOwnedRequest(this.reservationRequestRepository, requestId, userId);
    const client = await this.clientRepository.findById(request.clientId);
    const assignedResources =
      await this.assignedResourceRepository.findActiveByRequestId(requestId);
    const latestAgreements =
      await this.derivedInformationRepository.findLatestByRequestId(requestId);

    const confirmedStatuses = [
      ReservationRequestStatus.CONFIRMED,
      ReservationRequestStatus.FINALIZED,
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
    });
  }
}

module.exports = { GetRequestAgreementsUseCase };
