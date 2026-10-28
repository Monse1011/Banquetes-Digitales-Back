const { canTransition } = require("./request-status-transition");
const { ReservationRequestStatus } = require("../enums/reservation-request/request-status");

describe("Transiciones del ciclo de confirmación (Incremento 3)", () => {
  it("permite propuesta generada -> en revisión (RF-3.4.4.2)", () => {
    expect(
      canTransition(ReservationRequestStatus.PROPOSAL_GENERATED, ReservationRequestStatus.IN_REVIEW)
    ).toBe(true);
  });

  it("permite en revisión -> confirmado/ajustes/rechazada", () => {
    expect(
      canTransition(ReservationRequestStatus.IN_REVIEW, ReservationRequestStatus.CONFIRMED)
    ).toBe(true);
    expect(
      canTransition(
        ReservationRequestStatus.IN_REVIEW,
        ReservationRequestStatus.ADJUSTMENTS_REQUESTED
      )
    ).toBe(true);
    expect(
      canTransition(ReservationRequestStatus.IN_REVIEW, ReservationRequestStatus.REJECTED)
    ).toBe(true);
  });

  it("rechaza transiciones ilegales", () => {
    expect(
      canTransition(ReservationRequestStatus.PENDING, ReservationRequestStatus.IN_REVIEW)
    ).toBe(false);
    expect(
      canTransition(ReservationRequestStatus.CONFIRMED, ReservationRequestStatus.IN_REVIEW)
    ).toBe(false);
    expect(
      canTransition(ReservationRequestStatus.REJECTED, ReservationRequestStatus.CONFIRMED)
    ).toBe(false);
  });
});
