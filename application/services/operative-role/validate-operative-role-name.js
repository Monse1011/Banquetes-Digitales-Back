const { OperativeRoleMessages } = require("../../../domain/constants/operative-role-messages");

function validateOperativeRoleName(name) {
  if (typeof name !== "string" || name.trim().length === 0) {
    return { name: OperativeRoleMessages.NAME_REQUIRED };
  }

  if (name.trim().length > 100) {
    return { name: OperativeRoleMessages.NAME_TOO_LONG };
  }

  if (!/\p{L}/u.test(name)) {
    return { name: OperativeRoleMessages.NAME_NEEDS_LETTER };
  }

  return {};
}

module.exports = { validateOperativeRoleName };
