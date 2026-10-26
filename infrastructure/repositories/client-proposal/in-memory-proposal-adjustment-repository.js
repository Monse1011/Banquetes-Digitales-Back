const { ProposalAdjustment } = require("../../../domain/entities/proposal/proposal-adjustment");

// Réplica en memoria de PostgresProposalAdjustmentRepository (RF-3.4.4.5.6).
class InMemoryProposalAdjustmentRepository {
  constructor(proposalRepository = null) {
    this.proposalRepository = proposalRepository;
    this.adjustments = [];
    this.nextId = 1;
  }

  async create(adjustment) {
    const created = new ProposalAdjustment(
      this.nextId++,
      adjustment.proposalId,
      adjustment.observations,
      adjustment.createdAt ?? new Date()
    );

    this.adjustments.push(created);

    return created;
  }

  // Ordenadas de la más reciente a la más antigua (RF-3.4.4.5.6).
  async findByRequestId(requestId) {
    const proposalIds = this.proposalRepository
      ? new Set(
          this.proposalRepository.proposals
            .filter((proposal) => proposal.requestId === requestId)
            .map((proposal) => proposal.id)
        )
      : null;

    return this.adjustments
      .filter((adjustment) => !proposalIds || proposalIds.has(adjustment.proposalId))
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  }
}

module.exports = { InMemoryProposalAdjustmentRepository };
