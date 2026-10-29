const { toApiRequestStatus } = require("./request-status-api-code");
const { resolveProposalAccess, ProposalAccess } = require("../client-proposal/proposal-access");
const { resolveAvailableActions, ProposalAction } = require("../client-proposal/proposal-action");
const { ReservationRequestStatus } = require("./request-status");
const { ProposalStatus } = require("../proposal/proposal-status");

describe("Códigos del contrato RequestStatus (DAD §3)", () => {
  it("traduce los estados internos a los códigos exactos del contrato", () => {
    expect(toApiRequestStatus(ReservationRequestStatus.IN_REVIEW)).toBe("IN_REVIEW");
    expect(toApiRequestStatus(ReservationRequestStatus.ADJUSTMENTS_REQUESTED)).toBe(
      "ADJUSTMENTS_REQUESTED"
    );
    expect(toApiRequestStatus(ReservationRequestStatus.REJECTED)).toBe("REJECTED");
    expect(toApiRequestStatus(ReservationRequestStatus.FINALIZED)).toBe("FINALIZED");
    expect(toApiRequestStatus(ReservationRequestStatus.CANCELED)).toBe("CANCELED");
  });
});

describe("ProposalAccess (RF-3.4.5.6 a RF-3.4.5.14)", () => {
  it("es INTERACTIVE en propuesta generada y en revisión", () => {
    expect(resolveProposalAccess(ReservationRequestStatus.PROPOSAL_GENERATED)).toBe(
      ProposalAccess.INTERACTIVE
    );
    expect(resolveProposalAccess(ReservationRequestStatus.IN_REVIEW)).toBe(
      ProposalAccess.INTERACTIVE
    );
  });

  it("es PDF_ONLY en confirmado y finalizado", () => {
    expect(resolveProposalAccess(ReservationRequestStatus.CONFIRMED)).toBe(ProposalAccess.PDF_ONLY);
    expect(resolveProposalAccess(ReservationRequestStatus.FINALIZED)).toBe(ProposalAccess.PDF_ONLY);
  });

  it("es NONE en ajustes solicitados y rechazada (RF-3.4.5.13/14)", () => {
    expect(resolveProposalAccess(ReservationRequestStatus.ADJUSTMENTS_REQUESTED)).toBe(
      ProposalAccess.NONE
    );
    expect(resolveProposalAccess(ReservationRequestStatus.REJECTED)).toBe(ProposalAccess.NONE);
    expect(resolveProposalAccess(ReservationRequestStatus.PENDING)).toBe(ProposalAccess.NONE);
  });
});

describe("available_actions (RF-3.4.4.4 / RF-3.4.4.6.5)", () => {
  it("expone las tres acciones solo con solicitud y propuesta en revisión", () => {
    expect(
      resolveAvailableActions(ReservationRequestStatus.IN_REVIEW, ProposalStatus.IN_REVIEW)
    ).toEqual([ProposalAction.ACCEPT, ProposalAction.REQUEST_ADJUSTMENTS, ProposalAction.REJECT]);
  });

  it("queda vacío tras aceptar o rechazar", () => {
    expect(
      resolveAvailableActions(ReservationRequestStatus.CONFIRMED, ProposalStatus.ACCEPTED)
    ).toEqual([]);
    expect(
      resolveAvailableActions(ReservationRequestStatus.REJECTED, ProposalStatus.REJECTED)
    ).toEqual([]);
    expect(
      resolveAvailableActions(ReservationRequestStatus.PROPOSAL_GENERATED, ProposalStatus.IN_REVIEW)
    ).toEqual([]);
  });
});
