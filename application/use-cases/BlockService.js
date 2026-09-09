const AccountBlockedException = require("../../domain/exceptions/AccountBlockedException");

class BlockService {
  constructor(blockRepository) {
    this.blockRepository = blockRepository;
  }

  async isBlocked(idUser) {
    const block = await this.blockRepository.findByUserId(idUser);
    if (!block || !block.blocked_until) return false;
    if (new Date(block.blocked_until) > new Date()) return true;
    await this.blockRepository.resetAttempts(idUser);
    return false;
  }

  async ensureNotBlocked(idUser) {
    if (await this.isBlocked(idUser)) throw new AccountBlockedException();
  }

  async registerFailedAttempt(idUser) {
    const attempts = await this.blockRepository.incrementFailedAttempts(idUser);
    if (attempts.failed_attempts >= 3) {
      await this.blockRepository.blockUser(idUser);
      return true;
    }
    return false;
  }

  async reset(idUser) {
    await this.blockRepository.resetAttempts(idUser);
  }
}
module.exports = BlockService;
