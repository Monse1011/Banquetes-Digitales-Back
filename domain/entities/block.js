class Block {
  constructor(data) {
    Object.assign(this, data);
  }
  isCurrentlyBlocked() {
    return Boolean(this.blocked_until && new Date(this.blocked_until) > new Date());
  }
}
module.exports = Block;
