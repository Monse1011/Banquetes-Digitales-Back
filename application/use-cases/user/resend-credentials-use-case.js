const bcrypt = require("bcrypt");
const crypto = require("crypto");

class ResendCredentialsUseCase {
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

  async execute(userId) {
    const user = await this.userRepository.findById(userId);
    if (!user) {
      const err = new Error("Usuario no encontrado.");
      err.status = 404;
      throw err;
    }

    const tempPassword = this.generateTemporaryPassword();
    const passwordHash = await bcrypt.hash(tempPassword, 10);

    // Actualiza la contraseña e invalida la anterior, obligando a cambiar contraseña
    if (typeof this.userRepository.updatePassword === "function") {
      await this.userRepository.updatePassword(user.id, passwordHash);
    } else if (typeof this.userRepository.update === "function") {
      await this.userRepository.update(user.id, {
        password_hash: passwordHash,
        must_change_password: true,
      });
    }

    if (!this.emailService || typeof this.emailService.sendCredentials !== "function") {
      const err = new Error("El servicio de correo no está disponible.");
      err.status = 500;
      throw err;
    }

    try {
      await this.emailService.sendCredentials({
        to: user.email,
        fullName: user.full_name,
        tempPassword,
      });
    } catch (mailError) {
      console.error("Error al reenviar credenciales temporales:", mailError.message);
      const err = new Error(
        "No se pudo enviar el correo con las nuevas credenciales temporales. Por favor, intente nuevamente."
      );
      err.status = 500;
      throw err;
    }

    return {
      message: "Credenciales temporales regeneradas y enviadas exitosamente.",
      user_id: user.id,
      email: user.email,
    };
  }
}

module.exports = ResendCredentialsUseCase;
