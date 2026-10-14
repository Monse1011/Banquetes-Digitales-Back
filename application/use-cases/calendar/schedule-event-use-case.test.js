/* global vi */
const { ScheduleEventUseCase } = require("./schedule-event-use-case");
const {
  ReservationRequestStatus,
} = require("../../../domain/enums/reservation-request/request-status");
const UserRole = require("../../../domain/enums/auth/user-role");

describe("ScheduleEventUseCase", () => {
  const now = new Date("2026-10-11T12:00:00.000Z");

  it("builds event title with folio and client full name fulfilling RF-2.3.3.1", async () => {
    const reservationRequest = {
      requestId: 10,
      folio: "EVT-2026-0101",
      clientId: 5,
      logisticUserId: 12,
      status: ReservationRequestStatus.PROPOSAL_GENERATED,
    };
    const client = {
      clientId: 5,
      fullName: "Andrea Morales",
    };
    const createdEvent = {
      id: 1,
      requestId: 10,
      title: "EVT-2026-0101 - Andrea Morales",
      isSynced: () => true,
    };

    const reservationRequestRepository = {
      findById: vi.fn().mockResolvedValue(reservationRequest),
    };
    const clientRepository = {
      findById: vi.fn().mockResolvedValue(client),
    };
    const calendarEventRepository = {
      schedule: vi.fn().mockResolvedValue({
        status: "scheduled",
        event: createdEvent,
      }),
      findById: vi.fn().mockResolvedValue(createdEvent),
    };
    const syncProcessor = {
      execute: vi.fn().mockResolvedValue({ processed: 1, synced: 1, failed: 0 }),
    };

    const useCase = new ScheduleEventUseCase(
      reservationRequestRepository,
      clientRepository,
      calendarEventRepository,
      syncProcessor,
      () => now
    );

    const actor = { id_user: 12, role: UserRole.LOGISTICA };
    const result = await useCase.execute(10, actor);

    expect(reservationRequestRepository.findById).toHaveBeenCalledWith(10);
    expect(clientRepository.findById).toHaveBeenCalledWith(5);
    expect(calendarEventRepository.schedule).toHaveBeenCalledWith({
      requestId: 10,
      title: "EVT-2026-0101 - Andrea Morales",
      now,
    });
    expect(syncProcessor.execute).toHaveBeenCalledWith({ eventId: 1 });
    expect(result.event).toEqual(createdEvent);
    expect(result.syncWarning).toBeNull();
  });

  it("falls back to folio when client is not found", async () => {
    const reservationRequest = {
      requestId: 10,
      folio: "EVT-2026-0101",
      clientId: 999,
      logisticUserId: 12,
      status: ReservationRequestStatus.PROPOSAL_GENERATED,
    };
    const createdEvent = {
      id: 1,
      requestId: 10,
      title: "EVT-2026-0101",
      isSynced: () => true,
    };

    const reservationRequestRepository = {
      findById: vi.fn().mockResolvedValue(reservationRequest),
    };
    const clientRepository = {
      findById: vi.fn().mockResolvedValue(null),
    };
    const calendarEventRepository = {
      schedule: vi.fn().mockResolvedValue({
        status: "scheduled",
        event: createdEvent,
      }),
      findById: vi.fn().mockResolvedValue(createdEvent),
    };
    const syncProcessor = {
      execute: vi.fn().mockResolvedValue({ processed: 1, synced: 1, failed: 0 }),
    };

    const useCase = new ScheduleEventUseCase(
      reservationRequestRepository,
      clientRepository,
      calendarEventRepository,
      syncProcessor,
      () => now
    );

    const actor = { id_user: 12, role: UserRole.LOGISTICA };
    await useCase.execute(10, actor);

    expect(calendarEventRepository.schedule).toHaveBeenCalledWith({
      requestId: 10,
      title: "EVT-2026-0101",
      now,
    });
  });
});
