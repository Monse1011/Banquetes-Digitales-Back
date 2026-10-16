// DAD 010 §7.3: propuesta formal enviada al cliente para su revisión.
class Proposal {
  constructor(
    id,
    derivedInformationId,
    proposalsCode,
    name,
    creationDate,
    status,
    clientObservations,
    createdByUserId,
    createdAt
  ) {
    this.id = id;
    this.derivedInformationId = derivedInformationId;
    this.proposalsCode = proposalsCode;
    this.name = name;
    this.creationDate = creationDate;
    this.status = status;
    this.clientObservations = clientObservations ?? null;
    this.createdByUserId = createdByUserId ?? null;
    this.createdAt = createdAt ?? null;
  }
}

module.exports = { Proposal };
