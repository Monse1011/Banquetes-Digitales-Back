const { DerivedInformation } = require("../../../domain/entities/proposal/derived-information");

// Réplica en memoria de PostgresDerivedInformationRepository para pruebas.
class InMemoryDerivedInformationRepository {
  constructor() {
    this.informations = [];
    this.nextId = 1;
  }

  async create(information) {
    const created = new DerivedInformation(
      this.nextId++,
      information.eventRequestId,
      information.location,
      information.startDatetime,
      information.endDatetime,
      information.observations,
      information.createdByUserId,
      new Date()
    );

    this.informations.push(created);

    return created;
  }

  async findByIdAndRequestId(id, requestId) {
    return (
      this.informations.find(
        (information) => information.id === id && information.eventRequestId === requestId
      ) ?? null
    );
  }

  async findLatestByRequestId(requestId) {
    const ofRequest = this.informations.filter(
      (information) => information.eventRequestId === requestId
    );

    return ofRequest.length > 0 ? ofRequest[ofRequest.length - 1] : null;
  }
}

module.exports = { InMemoryDerivedInformationRepository };
