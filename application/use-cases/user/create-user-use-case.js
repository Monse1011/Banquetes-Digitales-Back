const bcrypt = require("bcrypt");
const crypto = require("crypto");
const UserRole = require("../../../domain/enums/auth/user-role");
const UserStatus = require("../../../domain/enums/user/user-status");

class CreateUserUseCase {
  constructor({ userRepository, emailService } = {}) {
    this.userRepository = userRepository;
    this.emailService = emailService;
  }

  generateTemporaryPassword() {
    const upper = "ABCDEFGHJKLMNPQRSTUVWXYZ";
    const lower = "abcdefghijkmnpqrstuvwxyz";
    const numbers = "23456789";
    const special = "!@#$%^&*";
    const all = upper + lower + numbers + special;

    let pwd = "";
    pwd += upper[crypto.randomInt(0, upper.length)];
    pwd += lower[crypto.randomInt(0, lower.length)];
    pwd += numbers[crypto.randomInt(0, numbers.length)];
    pwd += special[crypto.randomInt(0, special.length)];

    for (let i = 0; i < 6; i++) {
      pwd += all[crypto.randomInt(0, all.length)];
    }
    return pwd
      .split("")
      .sort(() => 0.5 - Math.random())
      .join("");
  }

  /**
   * Genera el identificador de empleado (employee_id) para el nuevo usuario.
   *
   * Justificación técnica (NC 12):
   * 1. ¿Por qué no autoincremental?
   *    - La persistencia relacional ya gestiona una clave primaria
   *      autoincremental (`id` / `id_user`) para la identidad técnica.
   *    - `employee_id` representa un identificador de negocio externo
   *      (código de nómina/credencial del personal). Mantener desacoplado
   *      el identificador de negocio de la clave técnica sigue los
   *      principios de DDD, evita exponer la numeración secuencial
   *      interna a los clientes y previene ataques de enumeración.
   * 2. ¿Por qué el formato y rango EMP-[100-999] y no más valores?
   *    - El prefijo "EMP-" y el rango de 3 dígitos (100 a 999) estandarizan
   *      la convención en los contratos API del DAD y prototipos (ej. "234").
   *    - El universo de 900 valores es suficiente y adecuado para la
   *      capacidad de la plantilla interna contemplada en este incremento.
   *    - Se utiliza un generador criptográficamente seguro (crypto.randomInt)
   *      para garantizar aleatoriedad y uniformidad en la distribución.
   */
  generateEmployeeId() {
    return `EMP-${crypto.randomInt(100, 999)}`;
  }

  validateInputs(fullName, email, role) {
    if (!fullName || fullName.trim().length === 0) {
      const err = new Error("El nombre completo es obligatorio.");
      err.status = 400;
      throw err;
    }
    if (fullName.trim().length > 100) {
      const err = new Error("El nombre completo no debe superar 100 caracteres.");
      err.status = 400;
      throw err;
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!email || !emailRegex.test(email.trim())) {
      const err = new Error("El correo electrónico es inválido.");
      err.status = 400;
      throw err;
    }
    let normalizedRole = (role || "").toUpperCase();
    if (normalizedRole === "LOGISTIC" || normalizedRole === "LOGISTICA") {
      normalizedRole = UserRole.LOGISTICS;
    }
    if (![UserRole.ADMIN, UserRole.LOGISTICS, UserRole.LOGISTIC].includes(normalizedRole)) {
      const err = new Error("Rol de usuario no válido. Debe ser ADMIN o LOGISTICS.");
      err.status = 400;
      throw err;
    }
    return normalizedRole;
  }

  async checkEmailUniqueness(email) {
    const existingUser = await this.userRepository.findByEmail(email.trim().toLowerCase());
    if (existingUser) {
      const err = new Error("Ya existe un usuario registrado con el correo electrónico indicado.");
      err.status = 409;
      throw err;
    }
  }

  async sendWelcomeEmail(newUser, tempPassword) {
    if (!this.emailService || typeof this.emailService.sendCredentials !== "function") {
      return;
    }
    try {
      await this.emailService.sendCredentials({
        to: newUser.email,
        fullName: newUser.full_name,
        tempPassword,
      });
    } catch (mailError) {
      console.error("Error al enviar correo con credenciales temporales:", mailError.message);
      const err = new Error(
        "No se pudo enviar el correo con las credenciales temporales al usuario. Por favor, intente nuevamente."
      );
      err.status = 500;
      throw err;
    }
  }

  async execute({ full_name: fullName, email, role }) {
    const normalizedRole = this.validateInputs(fullName, email, role);
    await this.checkEmailUniqueness(email);

    const tempPassword = this.generateTemporaryPassword();
    const passwordHash = await bcrypt.hash(tempPassword, 10);
    const employeeId = this.generateEmployeeId();

    let newUser;
    try {
      newUser = await this.userRepository.create({
        employee_id: employeeId,
        full_name: fullName.trim(),
        email: email.trim().toLowerCase(),
        password_hash: passwordHash,
        role: normalizedRole,
        status: UserStatus.ACTIVE,
        must_change_password: true,
      });

      await this.sendWelcomeEmail(newUser, tempPassword);
    } catch (error) {
      if (newUser && typeof this.userRepository.delete === "function") {
        await this.userRepository.delete(newUser.id).catch(() => {});
      }
      throw error;
    }

    return {
      id: newUser.id,
      employee_id: newUser.employee_id,
      full_name: newUser.full_name,
      email: newUser.email,
      role: newUser.role,
      status: newUser.status,
      created_at: newUser.created_at,
    };
  }
}

module.exports = CreateUserUseCase;
