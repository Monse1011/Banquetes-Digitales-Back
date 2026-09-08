const crypto = require('crypto');

class RequestPasswordReset {
    constructor(userRepository, passwordResetRepository, emailService) {
        this.userRepository = userRepository;
        this.passwordResetRepository = passwordResetRepository;
        this.emailService = emailService;
    }

    async execute(email) {
        const genericResponse = {
            message: 'Si existe una cuenta asociada a este correo, se enviará un enlace de restablecimiento'
        };

        const user = await this.userRepository.findByEmail(email);
        if (!user || user.status !== 'activo') return genericResponse;

        await this.passwordResetRepository.invalidateUserTokens(user.id_user);

        const token = crypto.randomBytes(32).toString('hex');
        const expirationDate = new Date(Date.now() + 15 * 60 * 1000);

        await this.passwordResetRepository.create(user.id_user, token, expirationDate);
        await this.emailService.sendPasswordResetEmail(user.email, user.full_name, token);

        return genericResponse;
    }
}
module.exports = RequestPasswordReset;
