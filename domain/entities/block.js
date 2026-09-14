class Block {
  constructor(id, userId, failedAttempts, blockedUntil) {
    this.id = id;
    this.userId = userId;
    this.failedAttempts = failedAttempts;
    this.blockedUntil = blockedUntil;
  }

  isCurrentlyBlocked() {
    return Boolean(this.blockedUntil && new Date(this.blockedUntil) > new Date());
  }
}
module.exports = Block;
