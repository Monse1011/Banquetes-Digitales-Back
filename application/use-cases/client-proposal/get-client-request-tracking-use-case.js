const InvalidFolioFormatException = require("../../../domain/exceptions/client-proposal/invalid-folio-format-exception");
const ClientRequestNotFoundException = require("../../../domain/exceptions/client-proposal/client-request-not-found-exception");
const { isValidFolio, normalizeFolio } = require("../../../domain/value-objects/folio");
const { resolveCurrentEventData } = require("../../services/client-proposal/current-event-data");
const {
  ClientTrackingResponseDto,
} = require("../../dto/client-proposal/client-tracking-response-dto");

// Función 4.5 (RF-3.4.5.1 a RF-3.4.5.14): el cliente consulta su solicitud por folio.
// Único medio de consulta: no se listan ni buscan solicitudes por otros datos (RF-3.4.5.12).
class GetClientRequestTrackingUseCase {
  constructor(reservationRequestRepository, clientRepository, derivedInformationRepository) {
    this.reservationRequestRepository = reservationRequestRepository;
    this.clientRepository = clientRepository;
    this.derivedInformationRepository = derivedInformationRepository;
  }

  async execute(rawFolio) {
    if (!isValidFolio(rawFolio)) {
      throw new InvalidFolioFormatException();
    }

    const folio = normalizeFolio(rawFolio);
    const request = await this.reservationRequestRepository.findByFolio(folio);

    if (!request) {
      throw new ClientRequestNotFoundException();
    }

    const latestInformation = await this.derivedInformationRepository.findLatestByRequestId(
      request.requestId
    );
    const client = await this.clientRepository.findById(request.clientId);

    return new ClientTrackingResponseDto({
      request,
      clientName: client?.fullName ?? request.clientName ?? null,
      eventData: resolveCurrentEventData(request, latestInformation),
    });
  }
}

module.exports = { GetClientRequestTrackingUseCase };
