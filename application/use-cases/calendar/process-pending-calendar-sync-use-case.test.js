/* global vi */
const { ProcessPendingCalendarSyncUseCase } = require("./process-pending-calendar-sync-use-case");
const { CalendarRules } = require("../../../domain/constants/calendar-rules");

describe("ProcessPendingCalendarSyncUseCase", () => {
  const now = new Date("2026-10-11T12:00:00.000Z");

  function buildUseCase({ gateway }) {
    const event = {
      id: 42,
      title: "Reservation 42",
      folio: "F-42",
      location: "Main hall",
      startAt: new Date("2026-11-01T18:00:00.000Z"),
      endAt: new Date("2026-11-01T22:00:00.000Z"),
      googleEventId: null,
      isCancelled: () => false,
    };
    const calendarEventRepository = {
      findById: vi.fn().mockResolvedValue(event),
    };
    const calendarSyncRepository = {
      claimNext: vi
        .fn()
        .mockResolvedValueOnce({
          id: 10,
          eventId: event.id,
          operation: "UPDATE",
          attempts: 1,
        })
        .mockResolvedValueOnce(null),
      markSynced: vi.fn().mockResolvedValue(undefined),
      markFailed: vi.fn().mockResolvedValue(undefined),
    };
    const useCase = new ProcessPendingCalendarSyncUseCase(
      calendarEventRepository,
      calendarSyncRepository,
      gateway,
      () => now
    );

    return { useCase, calendarEventRepository, calendarSyncRepository, event };
  }

  it("processes pending work for one event for immediate synchronization", async () => {
    const gateway = {
      upsertEvent: vi.fn().mockResolvedValue({ googleEventId: "google-event-42" }),
      deleteEvent: vi.fn(),
    };
    const { useCase, calendarSyncRepository, calendarEventRepository, event } = buildUseCase({
      gateway,
    });

    const result = await useCase.execute({ eventId: event.id, limit: 1 });

    expect(result).toEqual({ processed: 1, synced: 1, failed: 0 });
    expect(calendarSyncRepository.claimNext).toHaveBeenCalledWith({
      now,
      leaseUntil: new Date(now.getTime() + CalendarRules.SYNC_LEASE_SECONDS * 1000),
      eventId: event.id,
    });
    expect(calendarEventRepository.findById).toHaveBeenCalledWith(event.id);
    expect(gateway.upsertEvent).toHaveBeenCalledWith(
      "bdevent1a",
      {
        summary: event.title,
        description: `Folio: ${event.folio}`,
        location: event.location,
        startAt: event.startAt,
        endAt: event.endAt,
      },
      { exists: false }
    );
    expect(calendarSyncRepository.markSynced).toHaveBeenCalledWith({
      outboxId: 10,
      eventId: event.id,
      googleEventId: "google-event-42",
      now,
    });
  });

  it("records failed synchronization for a later retry", async () => {
    const gateway = {
      upsertEvent: vi.fn().mockRejectedValue(new Error("Google unavailable")),
      deleteEvent: vi.fn(),
    };
    const { useCase, calendarSyncRepository, event } = buildUseCase({ gateway });

    const result = await useCase.execute({ eventId: event.id, limit: 1 });

    expect(result).toEqual({ processed: 1, synced: 0, failed: 1 });
    expect(calendarSyncRepository.markFailed).toHaveBeenCalledWith(
      expect.objectContaining({
        outboxId: 10,
        eventId: event.id,
        errorMessage: "Google unavailable",
        now,
      })
    );
    expect(calendarSyncRepository.markSynced).not.toHaveBeenCalled();
  });
});
