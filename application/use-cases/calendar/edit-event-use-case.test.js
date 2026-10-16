/* global vi */
const UserRole = require("../../../domain/enums/auth/user-role");
const { EditEventUseCase } = require("./edit-event-use-case");

describe("EditEventUseCase DAD request fields", () => {
  it("rejects legacy field names before updating the event", async () => {
    const eventRepository = {
      findById: vi.fn().mockResolvedValue({ logisticUserId: 12 }),
      reschedule: vi.fn(),
    };
    const useCase = new EditEventUseCase(eventRepository, { execute: vi.fn() });

    await expect(
      useCase.execute(
        4,
        { id_user: 12, role: UserRole.LOGISTICS },
        {
          start_at: "2026-12-24T19:00:00Z",
        }
      )
    ).rejects.toMatchObject({
      name: "CalendarValidationException",
      errors: { start_at: expect.any(String) },
    });

    expect(eventRepository.reschedule).not.toHaveBeenCalled();
  });

  it("accepts a PATCH with DAD field names", async () => {
    const startAt = new Date(2026, 11, 24, 19);
    const endAt = new Date(2026, 11, 24, 23);
    const event = {
      id: 4,
      logisticUserId: 12,
      startAt: new Date("2026-12-24T18:00:00.000Z"),
      endAt: new Date("2026-12-24T22:00:00.000Z"),
      location: "Original",
      isConfirmed: () => true,
      hasStarted: () => false,
    };
    const updatedEvent = { ...event, startAt, endAt, location: "Updated", isSynced: () => true };
    const eventRepository = {
      findById: vi.fn().mockResolvedValueOnce(event).mockResolvedValue(updatedEvent),
      reschedule: vi.fn().mockResolvedValue({
        status: "rescheduled",
        event: updatedEvent,
      }),
    };
    const syncProcessor = { execute: vi.fn().mockResolvedValue({}) };
    const useCase = new EditEventUseCase(
      eventRepository,
      syncProcessor,
      () => new Date("2026-01-01T00:00:00.000Z")
    );

    await useCase.execute(
      4,
      { id_user: 12, role: UserRole.LOGISTICS },
      {
        start_datetime: "2026-12-24 19:00:00",
        end_datetime: "2026-12-24 23:00:00",
        location: "Updated",
      }
    );

    expect(eventRepository.reschedule).toHaveBeenCalledWith({
      eventId: 4,
      startAt,
      endAt,
      location: "Updated",
      now: new Date("2026-01-01T00:00:00.000Z"),
    });
  });
});
