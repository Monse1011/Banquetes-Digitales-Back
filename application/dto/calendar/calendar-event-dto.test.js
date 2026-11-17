const { toCalendarEventDto } = require("./calendar-event-dto");

describe("toCalendarEventDto", () => {
  it("returns only event fields defined by the DAD", () => {
    const event = {
      id: 12,
      requestId: 34,
      folio: "EVT-2026-0101",
      title: "Event",
      startAt: new Date("2026-12-24T18:00:05-06:00"),
      endAt: new Date("2026-12-24T23:00:09-06:00"),
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

  it("keeps the Mérida wall time of an event that crosses midnight, whatever the server zone", () => {
    const dto = toCalendarEventDto({
      id: 1,
      requestId: 1,
      folio: "EVT-2026-0102",
      title: "Event",
      startAt: new Date("2026-12-24T23:00:00-06:00"),
      endAt: new Date("2026-12-25T05:00:00-06:00"),
      location: "Main hall",
      status: "Confirmado",
    });

    expect(dto.start_datetime).toBe("2026-12-24 23:00:00");
    expect(dto.end_datetime).toBe("2026-12-25 05:00:00");
  });
});
