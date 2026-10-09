const UserRole = require("../../enums/auth/user-role");
const UserStatus = require("../../enums/user/user-status");

class User {
  constructor({
    id,
    employee_id: employeeId,
    full_name: fullName,
    email,
    password_hash: passwordHash,
    role = UserRole.LOGISTICS,
    status = UserStatus.ACTIVE,
    must_change_password: mustChangePassword = true,
    last_access: lastAccess = null,
    created_at: createdAt = null,
    updated_at: updatedAt = null
  }) {
    this.id = id;
    this.employee_id = employeeId;
    this.full_name = fullName;
    this.email = email;
    this.password_hash = passwordHash;
    this.role = role;
    this.status = status;
    this.must_change_password = mustChangePassword;
    this.last_access = lastAccess;
    this.created_at = createdAt;
    this.updated_at = updatedAt;
  }
}

module.exports = User;
