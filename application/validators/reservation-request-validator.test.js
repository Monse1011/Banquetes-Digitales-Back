const { validateCreateReservationRequest } = require("./reservation-request-validator");

function validDto(overrides = {}) {
  const eventDate = new Date();
  eventDate.setDate(eventDate.getDate() + 1);

  return {
    client_full_name: "John Doe",
    email: "john@example.com",
    phone: "1234567890",
    event_date_time: eventDate.toISOString(),
    guest_count: 100,
    event_address: "123 Main St",
    services_ids: [1, 2],
    ...overrides,
  };
}

describe("validateCreateReservationRequest", () => {
  it("should return no errors for a fully valid request", () => {
    const errors = validateCreateReservationRequest(validDto());

    expect(errors).toEqual({});
  });

  it("should reject a name with numbers or a single word", () => {
    const errors = validateCreateReservationRequest(validDto({ client_full_name: "John123" }));

    expect(errors.client_full_name).toBeDefined();
  });

  it("should reject an invalid email format", () => {
    const errors = validateCreateReservationRequest(validDto({ email: "not-an-email" }));

    expect(errors.email).toBeDefined();
  });

  it("should reject a phone number that is not exactly 10 digits", () => {
    const errors = validateCreateReservationRequest(validDto({ phone: "123" }));

    expect(errors.phone).toBeDefined();
  });

  it("should reject an event date in the past", () => {
    const errors = validateCreateReservationRequest(
      validDto({ event_date_time: "2000-01-01T10:00:00.000Z" })
    );

    expect(errors.event_date_time).toBeDefined();
  });

  it("should accept an event date scheduled for today", () => {
    const errors = validateCreateReservationRequest(
      validDto({ event_date_time: new Date().toISOString() })
    );

    expect(errors.event_date_time).toBeUndefined();
  });

  it("should reject a guest count of zero or a non-integer", () => {
    const zeroErrors = validateCreateReservationRequest(validDto({ guest_count: 0 }));
    const decimalErrors = validateCreateReservationRequest(validDto({ guest_count: 2.5 }));

    expect(zeroErrors.guest_count).toBeDefined();
    expect(decimalErrors.guest_count).toBeDefined();
  });

  it("should reject an empty services list", () => {
    const errors = validateCreateReservationRequest(validDto({ services_ids: [] }));

    expect(errors.services_ids).toBeDefined();
  });

  it("should reject a missing event address", () => {
    const errors = validateCreateReservationRequest(validDto({ event_address: "   " }));

    expect(errors.event_address).toBeDefined();
  });
});
