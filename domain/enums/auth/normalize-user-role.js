const UserRole = require("./user-role");

// Valores históricos que pudieron persistirse antes de alinear el enum con el DAD.
const LEGACY_ROLE_ALIASES = Object.freeze({
  LOGISTICA: UserRole.LOGISTICS,
});

// Devuelve el valor canónico de UserRole sin importar mayúsculas/minúsculas,
// o null si el valor no corresponde a ningún rol.
function normalizeUserRole(value) {
  const key = String(value ?? "")
    .trim()
    .toUpperCase();
  if (Object.values(UserRole).includes(key)) return key;
  return LEGACY_ROLE_ALIASES[key] || null;
}

// Valores equivalentes (canónico + históricos) para comparar contra la columna role.
function roleQueryValues(role) {
  const canonical = normalizeUserRole(role);
  if (!canonical) return [];
  const legacy = Object.keys(LEGACY_ROLE_ALIASES).filter(
    (alias) => LEGACY_ROLE_ALIASES[alias] === canonical
  );
  return [canonical, ...legacy];
}

module.exports = { normalizeUserRole, roleQueryValues };
