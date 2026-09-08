const AuthService = require('../services/AuthService');

class AuthController {

    constructor() {
        this.authService = new AuthService();
    }

    login = async (req, res) => {
        try {
            const { employeeId, password } = req.body || {};

            if (!employeeId || !password) {
                return res.status(400).json({
                    message: 'El ID de empleado y la contraseña son obligatorios'
                });
            }

            const result = await this.authService.authenticate(
                employeeId,
                password
            );

            return res.status(200).json(result);

        } catch (error) {

            console.error('Error en login:', error.message);

            if (error.message === 'Cuenta bloqueada temporalmente') {
                return res.status(423).json({
                    message: 'Cuenta bloqueada temporalmente'
                });
            }

            return res.status(401).json({
                message: 'Credenciales incorrectas'
            });
        }
    };

    changePassword = async (req, res) => {
        try {
            const {
                employeeId,
                currentPassword,
                newPassword
            } = req.body || {};

            if (!employeeId || !currentPassword || !newPassword) {
                return res.status(400).json({
                    message: 'El ID de empleado, la contraseña actual y la nueva contraseña son obligatorios'
                });
            }

            const result = await this.authService.changePassword(
                employeeId,
                currentPassword,
                newPassword
            );

            return res.status(200).json(result);

        } catch (error) {

            console.error('Error al cambiar contraseña:', error.message);

            return res.status(400).json({
                message: error.message
            });
        }
    };
}

module.exports = AuthController;