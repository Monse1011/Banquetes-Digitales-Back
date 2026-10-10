class InMemoryResourceConfirmationRepository {
  constructor(confirmations = []) {
    this.confirmations = confirmations;
    this.pendingObservations = new Map();
  }

  async create(confirmation, transaction = null) {
    this.confirmations.push(confirmation);

    transaction?.afterRollback(() => {
      this.confirmations = this.confirmations.filter((saved) => saved !== confirmation);
    });

    return confirmation;
  }

  async findLatestByRequest(requestId) {
    return (
      this.confirmations.filter((confirmation) => confirmation.requestId === requestId).at(-1) ??
      null
    );
  }

  async savePendingObservations(requestId, observations, transaction = null) {
    this.restorePendingObservationsOnRollback(requestId, transaction);
    this.pendingObservations.set(requestId, observations);
  }

  async findPendingObservations(requestId) {
    return this.pendingObservations.get(requestId) ?? null;
  }

  async deletePendingObservations(requestId, transaction = null) {
    this.restorePendingObservationsOnRollback(requestId, transaction);
    this.pendingObservations.delete(requestId);
  }

  restorePendingObservationsOnRollback(requestId, transaction) {
    const hadObservations = this.pendingObservations.has(requestId);
    const previous = this.pendingObservations.get(requestId);

    transaction?.afterRollback(() => {
      if (hadObservations) {
        this.pendingObservations.set(requestId, previous);
      } else {
        this.pendingObservations.delete(requestId);
      }
    });
  }
}

module.exports = { InMemoryResourceConfirmationRepository };
