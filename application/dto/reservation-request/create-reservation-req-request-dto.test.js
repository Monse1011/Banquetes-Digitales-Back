const CreateReservationRequestDto = require("./create-reservation-req-request-dto");

function validDto(overrides = {}) {
  const eventDate = new Date();
  eventDate.setDate(eventDate.getDate() + 1);

  const fields = {
    client_full_name: "John Doe",
    email: "john@example.com",
    phone: "1234567890",
    event_date_time: eventDate.toISOString(),
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

  it("should accept an event date scheduled for today", () => {
    const errors = validDto({ event_date_time: new Date().toISOString() }).validate();

    expect(errors.event_date_time).toBeUndefined();
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
});
