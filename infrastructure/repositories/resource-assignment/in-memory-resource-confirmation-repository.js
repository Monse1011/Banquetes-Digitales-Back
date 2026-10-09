class InMemoryResourceConfirmationRepository {
  constructor(confirmations = []) {
    this.confirmations = confirmations;
    this.pendingObservations = new Map();
  }

  async create(confirmation) {
    this.confirmations.push(confirmation);
    return confirmation;
  }

  async findLatestByRequest(requestId) {
    return (
      this.confirmations.filter((confirmation) => confirmation.requestId === requestId).at(-1) ??
      null
    );
  }

  async savePendingObservations(requestId, observations) {
    this.pendingObservations.set(requestId, observations);
  }

  async findPendingObservations(requestId) {
    return this.pendingObservations.get(requestId) ?? null;
  }

  async deletePendingObservations(requestId) {
    this.pendingObservations.delete(requestId);
  }
}

module.exports = { InMemoryResourceConfirmationRepository };
