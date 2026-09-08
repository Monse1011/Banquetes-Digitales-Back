const crypto = require('crypto');
const bcrypt = require('bcrypt');

const UserRepository = require('../repositories/UserRepository');
const PasswordResetRepository =
    require('../repositories/PasswordResetRepository');
const TokenService = require('./TokenService');
const validatePassword = require('../utils/passwordValidator');

const EmailService = require('./EmailService');

class PasswordResetService {

    constructor() {
        this.userRepository = new UserRepository();

        this.passwordResetRepository =
            new PasswordResetRepository();

        this.tokenService = new TokenService();

        this.emailService = new EmailService();
    }

    async requestPasswordReset(email) {

        const genericResponse = {
            message:
                'Si existe una cuenta asociada a este correo, se enviará un enlace de recuperación'
        };

        const user =
            await this.userRepository.findByEmail(email);

        if (!user) {
            return genericResponse;
        }

        if (user.status !== 'activo') {
            return genericResponse;
        }

        // Invalidar tokens anteriores
        await this.passwordResetRepository
            .invalidateUserTokens(user.id_user);

        // Generar token seguro
        const token =
            crypto.randomBytes(32).toString('hex');

        // Vigencia de 15 minutos
        const expirationDate =
            new Date(Date.now() + 15 * 60 * 1000);

        // Guardar token
        await this.passwordResetRepository.create(
            user.id_user,
            token,
            expirationDate
        );

        // Enviar correo
        await this.emailService.sendPasswordResetEmail(
            user.email,
            user.full_name,
            token
        );

        return genericResponse;
    }

    async resetPassword(token, newPassword) {

        const resetToken =
            await this.passwordResetRepository
                .findValidToken(token);

        if (!resetToken) {
            throw new Error(
                'El enlace de recuperación no es válido o ha expirado'
            );
        }

        const passwordValidation =
            validatePassword(newPassword);

        if (!passwordValidation.valid) {
            throw new Error(
                passwordValidation.message
            );
        }

        const newPasswordHash =
            await bcrypt.hash(newPassword, 10);

        await this.userRepository.updatePassword(
            resetToken.id_user,
            newPasswordHash
        );

        // Marcar el token utilizado
        await this.passwordResetRepository.markAsUsed(
            resetToken.id_token
        );

        // Invalidar cualquier otro token pendiente
        await this.passwordResetRepository
            .invalidateUserTokens(resetToken.id_user);

        const user = {
            id_user: resetToken.id_user,
            id_employee: resetToken.id_employee,
            full_name: resetToken.full_name,
            email: resetToken.email,
            role: resetToken.role
        };

        const jwt =
            this.tokenService.generateToken(user);

        return {
            requiresPasswordChange: false,
            token: jwt,
            user
        };
    }
}

module.exports = PasswordResetService;