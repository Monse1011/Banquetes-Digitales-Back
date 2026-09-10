const ForgotPasswordRequestDTO = require("../../application/dto/password-reset/forgot-password-request-dto");
const ResetPasswordRequestDTO = require("../../application/dto/password-reset/reset-password-request-dto");

class PasswordResetController {
  constructor(requestPasswordReset, resetPassword) {
    this.requestPasswordReset = requestPasswordReset;
    this.resetPasswordUseCase = resetPassword;
  }

  requestReset = async (req, res) => {
    try {
      const { email } = req.body || {};
      if (!email) return res.status(400).json({ message: "El correo electrónico es obligatorio" });
      const dto = new ForgotPasswordRequestDTO({ email });
      return res.status(200).json(await this.requestPasswordReset.execute(dto.email));
    } catch (error) {
      console.error("Error al solicitar restablecimiento:", error);
      return res.status(200).json({
        message:
          "Si existe una cuenta asociada a este correo, se enviará un enlace de restablecimiento",
      });
    }
  };

  resetPassword = async (req, res) => {
    try {
      const dto = new ResetPasswordRequestDTO(req.body || {});
      const { token, newPassword } = dto;
      if (!token || !newPassword)
        return res.status(400).json({ message: "El token y la nueva contraseña son obligatorios" });
      return res
        .status(200)
        .json(await this.resetPasswordUseCase.execute(dto.token, dto.newPassword));
    } catch (error) {
      console.error("Error al restablecer contraseña:", error.message);
      return res.status(400).json({ message: error.message });
    }
  };
}
module.exports = PasswordResetController;
