const bcrypt = require("bcrypt");
const Password = require("../../domain/value-objects/password");
const InvalidPasswordException = require("../../domain/exceptions/invalid-password-exception");

class ChangePassword {
  constructor(userRepository, blockService, tokenService) {
    this.userRepository = userRepository;
    this.blockService = blockService;
    this.tokenService = tokenService;
  }

  async execute(idUser, currentPassword, newPassword) {
    const user = await this.userRepository.findById(idUser);
    if (!user) throw new Error("Usuario no encontrado");
    if (user.status !== "activo") throw new Error("Usuario inactivo");

    const currentValid = await bcrypt.compare(currentPassword, user.password_hash);
    if (!currentValid) throw new InvalidPasswordException("La contraseña actual es incorrecta");
    if (currentPassword === newPassword)
      throw new InvalidPasswordException("La nueva contraseña debe ser diferente a la actual");

    const validation = Password.validate(newPassword);
    if (!validation.valid) throw new InvalidPasswordException(validation.message);

    const hash = await bcrypt.hash(newPassword, 10);
    await this.userRepository.updatePassword(idUser, hash);
    await this.blockService.reset(idUser);

    const updatedUser = { ...user, password_hash: hash, last_access: new Date() };
    const token = this.tokenService.generateToken(updatedUser, { mustChangePassword: false });

    return {
      requiresPasswordChange: false,
      token,
      user: {
        id_user: user.id_user,
        id_employee: user.id_employee,
        full_name: user.full_name,
        email: user.email,
        role: user.role,
      },
    };
  }
}
module.exports = ChangePassword;
