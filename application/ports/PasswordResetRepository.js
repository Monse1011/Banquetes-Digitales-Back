class PasswordResetRepository {
    async create() { throw new Error('Not implemented'); }
    async findValidToken() { throw new Error('Not implemented'); }
    async markAsUsed() { throw new Error('Not implemented'); }
    async invalidateUserTokens() { throw new Error('Not implemented'); }
}
module.exports = PasswordResetRepository;
