const { toCalendarEventDto } = require("./calendar-event-dto");

describe("toCalendarEventDto", () => {
  it("returns only event fields defined by the DAD", () => {
    const event = {
      id: 12,
      requestId: 34,
      folio: "EVT-2026-0101",
      title: "Event",
      startAt: new Date(2026, 11, 24, 18, 0, 5),
      endAt: new Date(2026, 11, 24, 23, 0, 9),
      location: "Main hall",
      logisticUserId: 27,
      logisticUserName: "Logistic User",
      status: "Confirmado",
      syncStatus: "Sincronizado",
    };

    const dto = toCalendarEventDto(event);

    expect(dto.start_datetime).toBe("2026-12-24 18:00:05");
    expect(dto.end_datetime).toBe("2026-12-24 23:00:09");
    expect(dto.event_id).toBe(event.id);
    expect(dto.logistics_responsible).toEqual({
      user_id: event.logisticUserId,
      full_name: event.logisticUserName,
    });
    expect(dto).not.toHaveProperty("id");
    expect(dto).not.toHaveProperty("start_at");
    expect(dto).not.toHaveProperty("end_at");
    expect(dto).not.toHaveProperty("event_date");
    expect(dto).not.toHaveProperty("start_time");
    expect(dto).not.toHaveProperty("end_time");
    expect(dto).not.toHaveProperty("logistic_user");
    expect(dto).not.toHaveProperty("request_detail_path");
  });
});
