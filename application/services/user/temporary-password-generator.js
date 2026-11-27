const crypto = require("crypto");

const UPPER = "ABCDEFGHJKLMNPQRSTUVWXYZ";
const LOWER = "abcdefghijkmnpqrstuvwxyz";
const NUMBERS = "23456789";
const SPECIAL = "!@#$%^&*";
const ALL = UPPER + LOWER + NUMBERS + SPECIAL;
const EXTRA_CHARACTERS = 6;

const pick = (characters) => characters[crypto.randomInt(0, characters.length)];

// RF-1.2.12.3: contraseña temporal aleatoria que cumple la política (mayúscula,
// minúscula, número y especial). Se mezcla con Fisher-Yates sobre crypto.randomInt.
function generateTemporaryPassword() {
  const chars = [pick(UPPER), pick(LOWER), pick(NUMBERS), pick(SPECIAL)];
  for (let i = 0; i < EXTRA_CHARACTERS; i += 1) {
    chars.push(pick(ALL));
  }
  for (let i = chars.length - 1; i > 0; i -= 1) {
    const j = crypto.randomInt(0, i + 1);
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }
  return chars.join("");
}

module.exports = { generateTemporaryPassword };
