class PasswordResetToken {
  constructor(id, userId, token, expirationDate, used, employeeId, fullName, email, role) {
    this.id = id;
    this.userId = userId;
    this.token = token;
    this.expirationDate = expirationDate;
    this.used = used;
    this.employeeId = employeeId;
    this.fullName = fullName;
    this.email = email;
    this.role = role;
  }

  isValid() {
    return !this.used && new Date(this.expirationDate) > new Date();
  }
}
module.exports = PasswordResetToken;
