const UserRole = require("../../../domain/enums/auth/user-role");
const { assertCanEditEvent, assertCanViewEvent } = require("./calendar-access-policy");

describe("calendar-access-policy", () => {
  it("uses the authenticated JWT id_user claim for event access", () => {
    const actor = { id_user: 27, role: UserRole.LOGISTICS };

    expect(() => assertCanViewEvent(actor, 27)).not.toThrow();
    expect(() => assertCanEditEvent(actor, 27)).not.toThrow();
  });

  it("does not grant access when the actor or event has no responsible ID", () => {
    expect(() => assertCanViewEvent({ role: UserRole.LOGISTICS }, undefined)).toThrow();
  });
});
