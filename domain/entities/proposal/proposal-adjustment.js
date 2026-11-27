// Incremento 3 (RF-3.4.4.5.6): observaciones del cliente sobre una propuesta vigente.
// Cada solicitud de ajustes se vincula a la versión de la propuesta que motivó el cambio.
class ProposalAdjustment {
  constructor(id, proposalId, observations, createdAt) {
    this.id = id;
    this.proposalId = proposalId;
    this.observations = observations;
    this.createdAt = createdAt ?? null;
  }
}

module.exports = { ProposalAdjustment };
