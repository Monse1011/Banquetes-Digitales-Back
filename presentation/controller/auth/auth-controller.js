const LoginRequestDTO = require("../../../application/dto/auth/login-request-dto");
const ChangePasswordRequestDTO = require("../../../application/dto/auth/change-password-request-dto");
const InvalidCredentialsException = require("../../../domain/exceptions/auth/invalid-credentials-exception");
const AccountBlockedException = require("../../../domain/exceptions/auth/account-blocked-exception");
const InvalidPasswordException = require("../../../domain/exceptions/password-reset/invalid-password-exception");
const {
  SecurityConstants,
  getAuthCookieOptions,
} = require("../../../domain/constants/security");
const ErrorMessages = require("../../constants/error-messages");

class AuthController {
  constructor(authenticateUser, changePassword, userRepository = null) {
    this.authenticateUser = authenticateUser;
    this.changePasswordUseCase = changePassword;
    this.userRepository = userRepository;
  }

  login = async (req, res) => {
    try {
      const { employeeId, password } = req.body || {};
      if (!employeeId || !password) {
        return res
          .status(400)
          .json({ message: "El ID de empleado y la contraseña son obligatorios" });
      }
      const dto = new LoginRequestDTO({ employeeId, password });
      const result = await this.authenticateUser.execute(dto.employeeId, dto.password);
      res.cookie(SecurityConstants.AUTH_COOKIE_NAME, result.token, getAuthCookieOptions());
      return res.status(200).json({ user: result.user });
    } catch (error) {
      console.error("Error en login:", error);
      if (error instanceof AccountBlockedException)
        return res.status(423).json({ message: ErrorMessages.ACCOUNT_BLOCKED });
      if (error instanceof InvalidCredentialsException)
        return res.status(401).json({ message: ErrorMessages.INVALID_CREDENTIALS });
      return res.status(500).json({ message: ErrorMessages.LOGIN_FAILED });
    }
  };

  firstAccess = async (req, res) => {
    try {
      if (!this.userRepository) {
        return res.status(500).json({ message: ErrorMessages.FIRST_ACCESS_CHECK_FAILED });
      }

      const user = await this.userRepository.findById(req.user.id_user);
      return res.status(200).json({
        firstAccess: user ? user.isFirstAccess() : false,
      });
    } catch (error) {
      console.error("Error al consultar primer acceso:", error);
      return res.status(500).json({ message: ErrorMessages.FIRST_ACCESS_CHECK_FAILED });
    }
  };

  changePassword = async (req, res) => {
    try {
      const dto = new ChangePasswordRequestDTO(req.body || {});
      if (!dto.password || !dto.new_password) {
        return res
          .status(400)
          .json({ message: "La contraseña actual y la nueva contraseña son obligatorias" });
      }
      const result = await this.changePasswordUseCase.execute(
        req.user.id_user,
        dto.password,
        dto.new_password
      );
      res.cookie(SecurityConstants.AUTH_COOKIE_NAME, result.token, getAuthCookieOptions());
      return res.status(200).json({ user: result.user });
    } catch (error) {
      console.error("Error al cambiar contraseña:", error);
      if (error instanceof InvalidPasswordException) {
        return res.status(400).json({ message: ErrorMessages.INVALID_PASSWORD });
      }
      return res.status(500).json({ message: ErrorMessages.PASSWORD_CHANGE_FAILED });
    }
  };
}
module.exports = AuthController;
