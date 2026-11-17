const { validateOperativeRoleName } = require("./validate-operative-role-name");
const { OperativeRoleMessages } = require("../../../domain/constants/operative-role-messages");

describe("validateOperativeRoleName", () => {
  it("rejects names made only of numbers or symbols", () => {
    for (const name of ["123", "42 7", "-- 1"]) {
      expect(validateOperativeRoleName(name)).toEqual({
        name: OperativeRoleMessages.NAME_NEEDS_LETTER,
      });
    }
  });

  it("accepts names with at least one letter", () => {
    expect(validateOperativeRoleName("Mesero")).toEqual({});
    expect(validateOperativeRoleName("Capitán")).toEqual({});
  });

  it("rejects names containing digits", () => {
    expect(validateOperativeRoleName("Mesero 2")).toEqual({
      name: OperativeRoleMessages.NAME_NO_DIGITS,
    });
  });
});
