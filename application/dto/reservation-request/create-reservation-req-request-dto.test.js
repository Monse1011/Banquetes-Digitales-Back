const CreateReservationRequestDto = require("./create-reservation-req-request-dto");

// Más de 3 meses: cumple cualquier plazo de anticipación por temporada.
const FAR_FUTURE_MS = 400 * 24 * 60 * 60 * 1000;

function validDto(overrides = {}) {
  const eventDate = new Date();
  eventDate.setTime(eventDate.getTime() + FAR_FUTURE_MS);

  const fields = {
    client_full_name: "John Doe",
    email: "john@example.com",
    phone: "1234567890",
    event_date_time: eventDate.toISOString(),
    event_end_time: new Date(eventDate.getTime() + 2 * 60 * 60 * 1000).toISOString(),
    guest_count: 100,
    event_address: "123 Main St",
    services_ids: [1, 2],
    ...overrides,
  };

  return new CreateReservationRequestDto(
    fields.client_full_name,
    fields.email,
    fields.phone,
    fields.event_date_time,
    fields.event_end_time,
    fields.guest_count,
    fields.event_address,
    fields.services_ids
  );
}

describe("CreateReservationRequestDto", () => {
  it("should return no errors for a fully valid request", () => {
    expect(validDto().validate()).toEqual({});
  });

  it("should reject a name with numbers or a single word", () => {
    const errors = validDto({ client_full_name: "John123" }).validate();

    expect(errors.client_full_name).toBeDefined();
  });

  it("should reject an invalid email format", () => {
    const errors = validDto({ email: "not-an-email" }).validate();

    expect(errors.email).toBeDefined();
  });

  it("should reject a phone number that is not exactly 10 digits", () => {
    const errors = validDto({ phone: "123" }).validate();

    expect(errors.phone).toBeDefined();
  });

  it("should reject an event date in the past", () => {
    const errors = validDto({ event_date_time: "2000-01-01T10:00:00.000Z" }).validate();

    expect(errors.event_date_time).toBeDefined();
  });

  it("should accept an event date far enough in advance", () => {
    const errors = validDto({
      event_date_time: new Date(Date.now() + FAR_FUTURE_MS + 60 * 1000).toISOString(),
    }).validate();

    expect(errors.event_date_time).toBeUndefined();
  });

  it("should reject a missing or invalid event end time", () => {
    const missingErrors = validDto({ event_end_time: undefined }).validate();
    const invalidErrors = validDto({ event_end_time: "not-a-date" }).validate();

    expect(missingErrors.event_end_time).toBeDefined();
    expect(invalidErrors.event_end_time).toBeDefined();
  });

  it("should reject an event end time not after the start time", () => {
    const errors = validDto({ event_end_time: validDto().event_date_time }).validate();

    expect(errors.event_end_time).toBeDefined();
  });

  it("should reject a guest count of zero or a non-integer", () => {
    const zeroErrors = validDto({ guest_count: 0 }).validate();
    const decimalErrors = validDto({ guest_count: 2.5 }).validate();

    expect(zeroErrors.guest_count).toBeDefined();
    expect(decimalErrors.guest_count).toBeDefined();
  });

  it("should reject an empty services list", () => {
    const errors = validDto({ services_ids: [] }).validate();

    expect(errors.services_ids).toBeDefined();
  });

  it("should reject a missing event address", () => {
    const errors = validDto({ event_address: "   " }).validate();

    expect(errors.event_address).toBeDefined();
  });

  it("should reject a start earlier today (the time already passed)", () => {
    const errors = validDto({
      event_date_time: new Date(Date.now() - 60 * 1000).toISOString(),
      event_end_time: new Date(Date.now() + FAR_FUTURE_MS + 60 * 60 * 1000).toISOString(),
    }).validate();

    expect(errors.event_date_time).toMatch(/momento actual/);
  });

  it("should reject an end the next day that is later than the start time", () => {
    const start = new Date(Date.now() + FAR_FUTURE_MS);
    const errors = validDto({
      event_date_time: start.toISOString(),
      event_end_time: new Date(start.getTime() + 26 * 60 * 60 * 1000).toISOString(),
    }).validate();

    expect(errors.event_end_time).toBeDefined();
  });

  it("should reject an event without the lead time required by season and guests", () => {
    const soon = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
    const errors = validDto({ event_date_time: soon, event_end_time: soon }).validate();

    expect(errors.event_date_time).toMatch(/anticipación/);
  });
});
