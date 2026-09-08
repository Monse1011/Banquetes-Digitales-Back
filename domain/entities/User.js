class User {
    constructor(data) { Object.assign(this, data); }
    isActive() { return this.status === 'activo'; }
    isFirstAccess() { return this.last_access === null; }
}
module.exports = User;
