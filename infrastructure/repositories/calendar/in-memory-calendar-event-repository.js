class InMemoryCalendarEventRepository {
  constructor(events = []) {
    this.events = events;
    this.nextId = events.length > 0 ? Math.max(...events.map(e => e.eventId)) + 1 : 1;
    this.outbox = [];
    this.nextOutboxId = 1;
  }

  async schedule({ requestId, title, now }) {
    const event = {
      eventId: this.nextId++,
      requestId,
      title,
      startAt: new Date(now.getTime() + 3600000),
      endAt: new Date(now.getTime() + 7200000),
      logisticUserId: 1,
      status: 'Confirmado',
      syncStatus: 'Pendiente de sincronización',
      googleEventId: null
    };
    this.events.push(event);
    
    this.outbox.push({
      outboxId: this.nextOutboxId++,
      eventId: event.eventId,
      operation: 'CREATE',
      createdAt: now,
      status: 'PENDING',
      attempts: 0
    });

    return { status: 'scheduled', event };
  }

  async reschedule({ eventId, startAt, endAt, location, now }) {
    const event = this.events.find(e => e.eventId === eventId);
    if (!event) return { status: 'not_found' };
    if (event.status !== 'Confirmado') return { status: 'not_editable' };
    if (event.startAt <= now) return { status: 'already_started' };

    event.startAt = startAt;
    event.endAt = endAt;
    event.location = location;
    event.syncStatus = 'Pendiente de sincronización';

    this.outbox.push({
      outboxId: this.nextOutboxId++,
      eventId: event.eventId,
      operation: 'UPDATE',
      createdAt: now,
      status: 'PENDING',
      attempts: 0
    });

    return { status: 'rescheduled', event };
  }

  async cancel({ eventId, now }) {
    const event = this.events.find(e => e.eventId === eventId);
    if (!event) return { status: 'not_found' };
    if (event.status !== 'Confirmado') return { status: 'not_cancellable' };

    event.status = 'Cancelado';
    event.syncStatus = 'Pendiente de sincronización';

    this.outbox.push({
      outboxId: this.nextOutboxId++,
      eventId: event.eventId,
      operation: 'DELETE',
      createdAt: now,
      status: 'PENDING',
      attempts: 0
    });

    return { status: 'cancelled', event };
  }

  async findById(id) {
    return this.events.find(e => e.eventId === id) || null;
  }

  async findAll({ logisticUserId, dayStart, dayEnd, includeCancelled }, page, perPage) {
    let filtered = this.events;
    if (logisticUserId) {
      filtered = filtered.filter(e => e.logisticUserId === logisticUserId);
    }
    if (dayStart && dayEnd) {
      filtered = filtered.filter(e => e.startAt >= dayStart && e.startAt <= dayEnd);
    }
    if (!includeCancelled) {
      filtered = filtered.filter(e => e.status !== 'Cancelado');
    }

    const start = (page - 1) * perPage;
    return {
      events: filtered.slice(start, start + perPage),
      totalRecords: filtered.length
    };
  }

  async finalizeElapsed(now) {
    let count = 0;
    for (const e of this.events) {
      if (e.status === 'Confirmado' && e.endAt <= now) {
        e.status = 'Finalizado';
        count++;
      }
    }
    return count;
  }
}

module.exports = { InMemoryCalendarEventRepository };
