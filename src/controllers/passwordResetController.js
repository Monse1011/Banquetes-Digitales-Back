const PasswordResetService =
    require('../services/PasswordResetService');

class PasswordResetController {

    constructor() {
        this.passwordResetService =
            new PasswordResetService();
    }

    requestReset = async (req, res) => {

        try {

            const { email } = req.body || {};

            if (!email) {
                return res.status(400).json({
                    message: 'El correo electrónico es obligatorio'
                });
            }

            const result =
                await this.passwordResetService
                    .requestPasswordReset(email);

            return res.status(200).json(result);

        } catch (error) {

            console.error(
                'Error al solicitar recuperación:',
                error.message
            );

            return res.status(500).json({
                message:
                    'No fue posible procesar la solicitud'
            });
        }
    };

    resetPassword = async (req, res) => {

        try {

            const {
                token,
                newPassword
            } = req.body || {};

            if (!token || !newPassword) {
                return res.status(400).json({
                    message:
                        'El token y la nueva contraseña son obligatorios'
                });
            }

            const result =
                await this.passwordResetService
                    .resetPassword(
                        token,
                        newPassword
                    );

            return res.status(200).json(result);

        } catch (error) {

            console.error(
                'Error al restablecer contraseña:',
                error.message
            );

            return res.status(400).json({
                message: error.message
            });
        }
    };
}

module.exports = PasswordResetController;