const crypto = require("crypto");
const UserMessages = require("../../../domain/constants/user-messages");

/**
 * Genera el identificador de empleado (employee_id) para el nuevo usuario (NC-12).
 *
 * 1. ¿Por qué no autoincremental?
 *    - La base de datos ya gestiona una clave primaria autoincremental (`id`) para la
 *      identidad técnica. `employee_id` es un identificador de negocio y además el
 *      identificador de inicio de sesión: un valor secuencial revelaría la cantidad de
 *      usuarios y facilitaría adivinar identificadores válidos (enumeración).
 * 2. ¿Por qué EMP-[100-999] y no más valores?
 *    - El rango de 3 dígitos (900 valores) es suficiente para la plantilla interna
 *      contemplada en este incremento y mantiene la convención de los prototipos.
 *    - Se usa crypto.randomInt para una distribución uniforme.
 * 3. Colisiones: se verifica la unicidad antes de insertar y se reintenta un número
 *    acotado de veces; la restricción UNIQUE de la base de datos es la última barrera.
 */
const EMPLOYEE_ID_PREFIX = "EMP-";
const EMPLOYEE_ID_MIN = 100;
const EMPLOYEE_ID_MAX = 999; // inclusive
const MAX_ATTEMPTS = 10;

async function generateUniqueEmployeeId(userRepository, randomInt = crypto.randomInt) {
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt += 1) {
    const candidate = `${EMPLOYEE_ID_PREFIX}${randomInt(EMPLOYEE_ID_MIN, EMPLOYEE_ID_MAX + 1)}`;
    // eslint-disable-next-line no-await-in-loop
    if (!(await userRepository.existsByEmployeeId(candidate))) {
      return candidate;
    }
  }
  const err = new Error(UserMessages.EMPLOYEE_ID_UNAVAILABLE);
  err.status = 500;
  throw err;
}

module.exports = { generateUniqueEmployeeId };
