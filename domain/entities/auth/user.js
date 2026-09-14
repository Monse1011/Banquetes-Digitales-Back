const UserStatus = require("../enums/user-status");

class User {
  constructor(
    id,
    employeeId,
    fullName,
    email,
    passwordHash,
    role,
    status,
    creationDate,
    lastAccess
  ) {
    this.id = id;
    this.employeeId = employeeId;
    this.fullName = fullName;
    this.email = email;
    this.passwordHash = passwordHash;
    this.role = role;
    this.status = status;
    this.creationDate = creationDate;
    this.lastAccess = lastAccess;
  }

  isActive() {
    return this.status === UserStatus.ACTIVE;
  }

  isFirstAccess() {
    return this.lastAccess === null;
  }
}
module.exports = User;
