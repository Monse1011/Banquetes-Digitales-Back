class PasswordResetToken {
    constructor(data) { Object.assign(this, data); }
    isValid() { return !this.used && new Date(this.expiration_date) > new Date(); }
}
module.exports = PasswordResetToken;
