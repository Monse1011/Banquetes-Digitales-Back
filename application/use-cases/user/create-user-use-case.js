const bcrypt = require("bcrypt");
const UserRole = require("../../../domain/enums/auth/user-role");
const { generateTemporaryPassword } = require("../../services/user/temporary-password-generator");
const { generateUniqueEmployeeId } = require("../../services/user/employee-id-generator");
const { deliverCredentials } = require("../../services/user/credentials-delivery");
const UserStatus = require("../../../domain/enums/user/user-status");

class CreateUserUseCase {
  constructor({ userRepository, emailService } = {}) {
    this.userRepository = userRepository;
    this.emailService = emailService;
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
    if (!Object.values(UserRole).includes(role)) {
      const err = new Error("Rol de usuario no válido. Debe ser ADMIN o LOGISTICS.");
      err.status = 400;
      throw err;
    }
  }

  async checkEmailUniqueness(email) {
    const existingUser = await this.userRepository.findByEmail(email.trim().toLowerCase());
    if (existingUser) {
      const err = new Error("Ya existe un usuario registrado con el correo electrónico indicado.");
      err.status = 409;
      throw err;
    }
  }

  async execute({ full_name: fullName, email, role }) {
    this.validateInputs(fullName, email, role);
    await this.checkEmailUniqueness(email);

    const tempPassword = generateTemporaryPassword();
    const passwordHash = await bcrypt.hash(tempPassword, 10);
    const employeeId = await generateUniqueEmployeeId(this.userRepository);

    const newUser = await this.userRepository.create({
      employee_id: employeeId,
      full_name: fullName.trim(),
      email: email.trim().toLowerCase(),
      password_hash: passwordHash,
      role,
      status: UserStatus.ACTIVE,
      must_change_password: true,
    });

    // RF-1.2.12.3: si el envío falla, el usuario se conserva y se informa al administrador.
    await deliverCredentials(this.emailService, newUser, tempPassword);

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
