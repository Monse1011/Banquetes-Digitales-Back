/* global vi */
const UserRole = require("../../../domain/enums/auth/user-role");
const { ListCalendarEventsUseCase } = require("./list-calendar-events-use-case");

describe("ListCalendarEventsUseCase", () => {
  it("filters logistics events using the JWT id_user claim", async () => {
    const calendarEventRepository = {
      finalizeElapsed: vi.fn().mockResolvedValue(undefined),
      findAll: vi.fn().mockResolvedValue({ events: [], totalRecords: 0 }),
    };
    const useCase = new ListCalendarEventsUseCase(
      calendarEventRepository,
      () => new Date("2026-01-01T00:00:00.000Z")
    );

    await useCase.execute({
      actor: { id_user: 27, role: UserRole.LOGISTICA },
    });

    expect(calendarEventRepository.findAll).toHaveBeenCalledWith(
      { includeCancelled: false, logisticUserId: 27 },
      1,
      expect.any(Number)
    );
  });
});
