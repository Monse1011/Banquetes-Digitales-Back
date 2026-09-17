const User = require("../../../domain/entities/auth/user");
const UserStatus = require("../../../domain/enums/auth/user-status");
const UserRole = require("../../../domain/enums/auth/user-role");

class PostgresUserRepository {
  constructor(pool) {
    this.pool = pool;
  }

  async findByEmployeeId(idEmployee) {
    const result = await this.pool.query(
      `
            SELECT id_user, id_employee, full_name, email, password_hash,
                    role, status, creation_date, last_access
            FROM users WHERE id_employee = $1`,
      [idEmployee]
    );
    return result.rows[0] ? this.toEntity(result.rows[0]) : null;
  }

  async findById(idUser) {
    const result = await this.pool.query(
      `
            SELECT id_user, id_employee, full_name, email, password_hash,
                    role, status, creation_date, last_access
            FROM users WHERE id_user = $1`,
      [idUser]
    );
    return result.rows[0] ? this.toEntity(result.rows[0]) : null;
  }

  async findByEmail(email) {
    const result = await this.pool.query(
      `
            SELECT id_user, id_employee, full_name, email, password_hash,
                    role, status, creation_date, last_access
            FROM users WHERE email = $1`,
      [email]
    );
    return result.rows[0] ? this.toEntity(result.rows[0]) : null;
  }

  async updateLastAccess(idUser) {
    await this.pool.query("UPDATE users SET last_access = NOW() WHERE id_user = $1", [idUser]);
  }

  async updatePassword(idUser, passwordHash) {
    await this.pool.query(
      `
            UPDATE users SET password_hash = $1, last_access = NOW()
            WHERE id_user = $2`,
      [passwordHash, idUser]
    );
  }

  toEntity(row) {
    const rawStatus = row.status ? String(row.status).toLowerCase() : "";
    const status = rawStatus === UserStatus.ACTIVE ? UserStatus.ACTIVE : UserStatus.INACTIVE;

    const rawRole = row.role ? String(row.role).toLowerCase() : "";
    const role = rawRole === UserRole.ADMIN ? UserRole.ADMIN : UserRole.LOGISTICA;

    return new User(
      row.id_user,
      row.id_employee,
      row.full_name,
      row.email,
      row.password_hash,
      role,
      status,
      row.creation_date,
      row.last_access
    );
  }
}

module.exports = PostgresUserRepository;
