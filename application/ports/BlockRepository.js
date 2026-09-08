class BlockRepository {
    async findByUserId() { throw new Error('Not implemented'); }
    async incrementFailedAttempts() { throw new Error('Not implemented'); }
    async blockUser() { throw new Error('Not implemented'); }
    async resetAttempts() { throw new Error('Not implemented'); }
}
module.exports = BlockRepository;
