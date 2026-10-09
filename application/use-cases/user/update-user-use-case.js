const UserRole = require("../../../domain/enums/auth/user-role");

class UpdateUserUseCase {
  constructor({ userRepository } = {}) {
    this.userRepository = userRepository;
  }

  validateFullName(fullName) {
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
    return fullName.trim();
  }

  async validateEmail(email, user) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!email || !emailRegex.test(email.trim())) {
      const err = new Error("El correo electrónico es inválido.");
      err.status = 400;
      throw err;
    }
    const cleanEmail = email.trim().toLowerCase();
    if (cleanEmail !== user.email.toLowerCase()) {
      const existing = await this.userRepository.findByEmail(cleanEmail);
      if (existing && String(existing.id) !== String(user.id)) {
        const msg = "Ya existe un usuario registrado con el correo electrónico indicado.";
        const err = new Error(msg);
        err.status = 409;
        throw err;
      }
    }
    return cleanEmail;
  }

  async validateRole(role, user, id) {
    const normalizedRole = role.toUpperCase();
    if (![UserRole.ADMIN, UserRole.LOGISTICS].includes(normalizedRole)) {
      const err = new Error("Rol no válido. Debe ser ADMIN o LOGISTICS.");
      err.status = 400;
      throw err;
    }
    if (normalizedRole !== user.role) {
      const hasActive = await this.userRepository.hasActiveRequests(id);
      if (hasActive) {
        const msg = "El usuario tiene solicitudes asignadas activas y su rol no puede modificarse.";
        const err = new Error(msg);
        err.status = 409;
        throw err;
      }
    }
    return normalizedRole;
  }

  async execute(id, { full_name: fullName, email, role }) {
    const user = await this.userRepository.findById(id);
    if (!user) {
      const err = new Error("Usuario no encontrado.");
      err.status = 404;
      throw err;
    }

    const updates = {};
    if (fullName !== undefined) {
      updates.full_name = this.validateFullName(fullName);
    }
    if (email !== undefined) {
      updates.email = await this.validateEmail(email, user);
    }
    if (role !== undefined) {
      updates.role = await this.validateRole(role, user, id);
    }

    return this.userRepository.update(id, updates);
  }
}

module.exports = UpdateUserUseCase;
