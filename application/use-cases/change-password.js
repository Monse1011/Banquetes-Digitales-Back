const bcrypt = require("bcrypt");
const Password = require("../../domain/value-objects/password");
const InvalidPasswordException = require("../../domain/exceptions/invalid-password-exception");
const UserStatus = require("../../domain/enums/user-status");

class ChangePassword {
  constructor(userRepository, blockService, tokenService) {
    this.userRepository = userRepository;
    this.blockService = blockService;
    this.tokenService = tokenService;
  }

  async execute(idUser, currentPassword, newPassword) {
    const user = await this.userRepository.findById(idUser);
    if (!user) throw new Error("Usuario no encontrado");
    if (user.status !== UserStatus.ACTIVE) throw new Error("Usuario inactivo");

    const currentValid = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!currentValid) throw new InvalidPasswordException("La contraseña actual es incorrecta");
    if (currentPassword === newPassword)
      throw new InvalidPasswordException("La nueva contraseña debe ser diferente a la actual");

    const validation = new Password(newPassword).validate();
    if (!validation.valid) throw new InvalidPasswordException(validation.message);

    const hash = await bcrypt.hash(newPassword, 10);
    await this.userRepository.updatePassword(idUser, hash);
    await this.blockService.reset(idUser);

    const updatedUser = { ...user, passwordHash: hash, lastAccess: new Date() };
    const token = this.tokenService.generateToken(updatedUser, { mustChangePassword: false });

    return {
      requiresPasswordChange: false,
      token,
      user: {
        id_user: user.id,
        id_employee: user.employeeId,
        full_name: user.fullName,
        email: user.email,
        role: user.role,
      },
    };
  }
}
module.exports = ChangePassword;
