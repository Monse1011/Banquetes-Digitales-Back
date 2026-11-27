const UserRole = require("../../../domain/enums/auth/user-role");
const UserStatus = require("../../../domain/enums/user/user-status");

class ToggleUserStatusUseCase {
  constructor({ userRepository } = {}) {
    this.userRepository = userRepository;
  }

  resolveTargetStatus(status, isActive) {
    if (status !== undefined) {
      const s = String(status).toUpperCase();
      if ([UserStatus.ACTIVE, UserStatus.INACTIVE].includes(s)) {
        return s;
      }
    }
    if (isActive !== undefined) {
      return isActive === true || isActive === "true" ? UserStatus.ACTIVE : UserStatus.INACTIVE;
    }
    const err = new Error("Estado no válido. Debe ser ACTIVE o INACTIVE.");
    err.status = 400;
    throw err;
  }

  async validateDeactivation(targetUserId, currentUserId, user) {
    if (currentUserId && String(currentUserId) === String(targetUserId)) {
      const err = new Error("No se permite desactivar la propia cuenta en sesión.");
      err.status = 409;
      throw err;
    }
    if (user.role === UserRole.ADMIN) {
      const activeAdminsCount = await this.userRepository.countActiveAdmins();
      if (activeAdminsCount <= 1) {
        const err = new Error("No se permite desactivar al único Administrador General activo.");
        err.status = 409;
        throw err;
      }
    }
    const hasActive = await this.userRepository.hasActiveRequests(targetUserId);
    if (hasActive) {
      const msg = "El usuario tiene solicitudes asignadas activas y no puede eliminarse.";
      const err = new Error(msg);
      err.status = 409;
      throw err;
    }
  }

  async execute(targetUserId, { status, is_active: isActive, currentUserId }) {
    const user = await this.userRepository.findById(targetUserId);
    if (!user) {
      const err = new Error("Usuario no encontrado.");
      err.status = 404;
      throw err;
    }

    const targetStatus = this.resolveTargetStatus(status, isActive);
    if (targetStatus === UserStatus.INACTIVE) {
      await this.validateDeactivation(targetUserId, currentUserId, user);
    }

    await this.userRepository.updateStatus(targetUserId, targetStatus);
    return { id: targetUserId, status: targetStatus };
  }
}

module.exports = ToggleUserStatusUseCase;
