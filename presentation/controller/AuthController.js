const LoginRequestDTO = require('../../application/dto/auth/LoginRequestDTO');
const ChangePasswordRequestDTO = require('../../application/dto/auth/ChangePasswordRequestDTO');
const InvalidCredentialsException = require('../../domain/exceptions/InvalidCredentialsException');
const AccountBlockedException = require('../../domain/exceptions/AccountBlockedException');

class AuthController {
    constructor(authenticateUser, changePassword) {
        this.authenticateUser = authenticateUser;
        this.changePasswordUseCase = changePassword;
    }

    login = async (req, res) => {
        try {
            const { employeeId, password } = req.body || {};
            if (!employeeId || !password) {
                return res.status(400).json({ message: 'El ID de empleado y la contraseña son obligatorios' });
            }
            const dto = new LoginRequestDTO({ employeeId, password });
            return res.status(200).json(await this.authenticateUser.execute(dto.employeeId, dto.password));
        } catch (error) {
            if (error instanceof AccountBlockedException) return res.status(423).json({ message: error.message });
            if (error instanceof InvalidCredentialsException) return res.status(401).json({ message: error.message });
            console.error('Error en login:', error);
            return res.status(500).json({ message: 'No fue posible procesar el inicio de sesión' });
        }
    };

    changePassword = async (req, res) => {
        try {
            const dto = new ChangePasswordRequestDTO(req.body || {});
            const { currentPassword, newPassword } = dto;
            if (!currentPassword || !newPassword) {
                return res.status(400).json({ message: 'La contraseña actual y la nueva contraseña son obligatorias' });
            }
            const result = await this.changePasswordUseCase.execute(
                req.user.id_user,
                dto.currentPassword,
                dto.newPassword
            );
            return res.status(200).json(result);
        } catch (error) {
            console.error('Error al cambiar contraseña:', error.message);
            return res.status(400).json({ message: error.message });
        }
    };
}
module.exports = AuthController;
