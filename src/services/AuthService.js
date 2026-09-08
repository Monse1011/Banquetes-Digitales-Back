const bcrypt = require('bcrypt');
const UserRepository = require('../repositories/UserRepository');
const BlockRepository = require('../repositories/BlockRepository');
const TokenService = require('./TokenService');
const validatePassword = require('../utils/passwordValidator');

class AuthService {

    constructor() {
        this.userRepository = new UserRepository();
        this.blockRepository = new BlockRepository();
        this.tokenService = new TokenService();
    }

    async authenticate(idEmployee, password) {

        const user = await this.userRepository.findByEmployeeId(idEmployee);

        if (!user) {
            throw new Error('Credenciales incorrectas');
        }

        if (user.status !== 'activo') {
            throw new Error('Credenciales incorrectas');
        }

        // Verificar si el usuario está bloqueado
        const block = await this.blockRepository.findByUserId(user.id_user);

        if (block && block.blocked_until) {

            const blockedUntil = new Date(block.blocked_until);
            const now = new Date();

            if (blockedUntil > now) {
                throw new Error('Cuenta bloqueada temporalmente');
            }

            // Ya pasaron los 15 minutos
            await this.blockRepository.resetAttempts(user.id_user);
        }

        // Verificar contraseña
        const passwordValid = await bcrypt.compare(
            password,
            user.password_hash
        );

        if (!passwordValid) {

            const attempts =
                await this.blockRepository.incrementFailedAttempts(
                    user.id_user
                );

            if (attempts.failed_attempts >= 3) {

                await this.blockRepository.blockUser(user.id_user);

                throw new Error('Cuenta bloqueada temporalmente');
            }

            throw new Error('Credenciales incorrectas');
        }

        // Login correcto: reiniciar intentos
        await this.blockRepository.resetAttempts(user.id_user);

        const requiresPasswordChange = user.last_access === null;

        if (requiresPasswordChange) {
            return {
                requiresPasswordChange: true,
                user: {
                    id_user: user.id_user,
                    id_employee: user.id_employee,
                    full_name: user.full_name,
                    email: user.email,
                    role: user.role
                }
            };
        }

        const token = this.tokenService.generateToken(user);

        await this.userRepository.updateLastAccess(user.id_user);

        return {
            requiresPasswordChange: false,
            token,
            user: {
                id_user: user.id_user,
                id_employee: user.id_employee,
                full_name: user.full_name,
                email: user.email,
                role: user.role
            }
        };
    }

    async changePassword(idEmployee, currentPassword, newPassword) {

        const user = await this.userRepository.findByEmployeeId(idEmployee);

        if (!user) {
            throw new Error('Usuario no encontrado');
        }

        if (user.status !== 'activo') {
            throw new Error('Usuario inactivo');
        }

        const currentPasswordValid = await bcrypt.compare(
            currentPassword,
            user.password_hash
        );

        if (!currentPasswordValid) {
            throw new Error('La contraseña actual es incorrecta');
        }

        if (currentPassword === newPassword) {
            throw new Error(
                'La nueva contraseña debe ser diferente a la actual'
            );
        }

        const passwordValidation = validatePassword(newPassword);

        if (!passwordValidation.valid) {
            throw new Error(passwordValidation.message);
        }

        const newPasswordHash = await bcrypt.hash(
            newPassword,
            10
        );

        await this.userRepository.updatePassword(
            user.id_user,
            newPasswordHash
        );

        await this.blockRepository.resetAttempts(user.id_user);

        const token = this.tokenService.generateToken(user);

        return {
            requiresPasswordChange: false,
            token,
            user: {
                id_user: user.id_user,
                id_employee: user.id_employee,
                full_name: user.full_name,
                email: user.email,
                role: user.role
            }
        };
    }
}

module.exports = AuthService;