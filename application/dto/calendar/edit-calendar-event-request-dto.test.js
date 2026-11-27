const { EditCalendarEventRequestDto } = require("./edit-calendar-event-request-dto");

describe("EditCalendarEventRequestDto", () => {
  const now = new Date("2026-01-01T00:00:00.000Z");
  const event = {
    startAt: new Date("2026-12-24T18:00:00.000Z"),
    endAt: new Date("2026-12-24T23:00:00.000Z"),
    location: "Original location",
  };

  it("resolves the DAD date-time fields and location", () => {
    const dto = new EditCalendarEventRequestDto({
      start_datetime: "2026-12-24 19:00:00",
      end_datetime: "2026-12-25 00:00:00",
      location: "Updated location",
    });

    const result = dto.resolve(event, now);

    expect(result.errors).toEqual({});
    expect(result.startAt.getFullYear()).toBe(2026);
    expect(result.startAt.getMonth()).toBe(11);
    expect(result.startAt.getDate()).toBe(24);
    expect(result.startAt.getHours()).toBe(19);
    expect(result.endAt.getDate()).toBe(25);
    expect(result.endAt.getHours()).toBe(0);
    expect(result.location).toBe("Updated location");
  });

  it("rejects edit fields that are not part of the DAD contract", () => {
    const dto = new EditCalendarEventRequestDto({
      start_at: "2026-12-24T19:00:00.000Z",
      end_at: "2026-12-25T00:00:00.000Z",
    });

    expect(dto.unsupportedFieldsSent).toEqual(["start_at", "end_at"]);
  });

  it("rejects attempts to change the assigned logistic user or resources", () => {
    const dto = new EditCalendarEventRequestDto({
      location: "Updated location",
      logistic_user_id: 17,
      resources: [],
    });

    expect(dto.hasImmutableFields()).toBe(true);
    expect(dto.immutableFieldsSent).toEqual(["logistic_user_id", "resources"]);
  });

  it("reports invalid date-time values using the DAD field names", () => {
    const dto = new EditCalendarEventRequestDto({
      start_datetime: "2026-02-30 19:00:00",
      end_datetime: "2026-12-25 00:00:00",
    });

    expect(dto.resolve(event, now).errors).toHaveProperty("start_datetime");
  });
});
