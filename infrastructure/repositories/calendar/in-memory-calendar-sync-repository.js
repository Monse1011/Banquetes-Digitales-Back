class InMemoryCalendarSyncRepository {
  constructor(eventRepo) {
    this.eventRepo = eventRepo; // Para acceder a outbox
  }

  async claimNext({ now, leaseUntil, eventId }) {
    if (!this.eventRepo) return null;
    let target = null;
    for (const record of this.eventRepo.outbox) {
      if (record.status === 'PENDING' && (!record.nextAttemptAt || record.nextAttemptAt <= now)) {
        if (eventId && record.eventId !== eventId) continue;
        target = record;
        break;
      }
    }
    if (!target) return null;

    target.status = 'CLAIMED';
    target.nextAttemptAt = leaseUntil;
    target.attempts++;

    return {
      id: target.outboxId,
      eventId: target.eventId,
      operation: target.operation,
      attempts: target.attempts
    };
  }

  async markSynced({ outboxId, eventId, googleEventId, now }) {
    if (!this.eventRepo) return;
    const index = this.eventRepo.outbox.findIndex(o => o.outboxId === outboxId);
    if (index > -1) {
      this.eventRepo.outbox.splice(index, 1);
    }
    
    // Check if there are more pending
    const remaining = this.eventRepo.outbox.filter(o => o.eventId === eventId);
    if (remaining.length === 0) {
      const event = await this.eventRepo.findById(eventId);
      if (event) {
        event.googleEventId = googleEventId;
        event.syncStatus = 'Sincronizado';
      }
    }
  }

  async markFailed({ outboxId, eventId, errorMessage, nextAttemptAt, now }) {
    if (!this.eventRepo) return;
    const record = this.eventRepo.outbox.find(o => o.outboxId === outboxId);
    if (record) {
      record.status = 'PENDING';
      record.nextAttemptAt = nextAttemptAt;
    }
    const event = await this.eventRepo.findById(eventId);
    if (event) {
      event.syncStatus = 'Pendiente de sincronización';
    }
  }

  async requeue({ eventId, now }) {
    if (!this.eventRepo) return 0;
    let count = 0;
    for (const record of this.eventRepo.outbox) {
      if (record.eventId === eventId) {
        record.nextAttemptAt = now;
        record.status = 'PENDING';
        count++;
      }
    }
    return count;
  }
}

module.exports = { InMemoryCalendarSyncRepository };
