const { PostgresCalendarSyncRepository } = require("./postgres-calendar-sync-repository");
const { PostgresCalendarEventRepository } = require("./postgres-calendar-event-repository");
const { CalendarSyncOperation } = require("../../../domain/enums/calendar/calendar-sync-operation");
const { CalendarSyncStatus } = require("../../../domain/enums/calendar/calendar-sync-status");

describe("PostgreSQL calendar value mapping", () => {
  it.each(Object.entries(CalendarSyncOperation))(
    "reads the database operation %s",
    async (key, value) => {
      const pool = {
        query: async () => ({
          rows: [{ id_outbox: "4", calendar_event_id: "8", operation: key, attempts: 0 }],
        }),
      };
      const result = await new PostgresCalendarSyncRepository(pool).claimNext({
        now: new Date(),
        leaseUntil: new Date(),
      });
      expect(result).toEqual({ id: 4, eventId: 8, operation: value, attempts: 0 });
    }
  );

  it.each(Object.entries(CalendarSyncStatus))("keeps the public status for %s", (key, value) => {
    const event = new PostgresCalendarEventRepository({}).toEntity({
      id_event: 8,
      id_request: 2,
      logistic_user_id: null,
      sync_status: key,
      status: "CONFIRMED",
    });
    expect(event.syncStatus).toBe(value);
  });
});
