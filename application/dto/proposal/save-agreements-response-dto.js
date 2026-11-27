// Contrato DAD: respuesta de POST /api/logistics/requests/:id/derived-information.
class SaveAgreementsResponseDto {
  constructor(derivedInformationId) {
    this.data = { derived_information_id: derivedInformationId };
  }
}

module.exports = { SaveAgreementsResponseDto };
