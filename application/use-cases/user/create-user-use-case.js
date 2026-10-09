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
    return pwd.split("").sort(() => 0.5 - Math.random()).join("");
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
    const normalizedRole = (role || "").toUpperCase();
    if (![UserRole.ADMIN, UserRole.LOGISTICS].includes(normalizedRole)) {
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
        tempPassword
      });
    } catch (mailError) {
      console.error("Advertencia al enviar correo con credenciales temporales:", mailError.message);
    }
  }

  async execute({ full_name: fullName, email, role }) {
    const normalizedRole = this.validateInputs(fullName, email, role);
    await this.checkEmailUniqueness(email);

    const tempPassword = this.generateTemporaryPassword();
    const passwordHash = await bcrypt.hash(tempPassword, 10);
    const employeeId = `EMP-${crypto.randomInt(100, 999)}`;

    const newUser = await this.userRepository.create({
      employee_id: employeeId,
      full_name: fullName.trim(),
      email: email.trim().toLowerCase(),
      password_hash: passwordHash,
      role: normalizedRole,
      status: UserStatus.ACTIVE,
      must_change_password: true
    });

    await this.sendWelcomeEmail(newUser, tempPassword);

    return {
      id: newUser.id,
      employee_id: newUser.employee_id,
      full_name: newUser.full_name,
      email: newUser.email,
      role: newUser.role,
      status: newUser.status,
      created_at: newUser.created_at
    };
  }
}

module.exports = CreateUserUseCase;
