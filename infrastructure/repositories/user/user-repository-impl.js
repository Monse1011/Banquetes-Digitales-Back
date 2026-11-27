const {
  toDatabaseStatus,
  fromDatabaseStatus,
} = require("../reservation-request/postgres-request-status");
const UserRepository = require("../../../application/repositories/user/user-repository");
const User = require("../../../domain/entities/user/user");
const UserRole = require("../../../domain/enums/auth/user-role");
const UserStatus = require("../../../domain/enums/user/user-status");
const {
  UserResponsibilityReservationRequestStatuses,
} = require("../../../domain/enums/reservation-request/request-status");

class UserRepositoryImpl extends UserRepository {
  constructor({ pool } = {}) {
    super();
    this.pool = pool;
  }

  mapRowToEntity(row) {
    if (!row) return null;
    return new User({
      id: Number(row.id_user),
      employee_id: row.id_employee,
      full_name: row.full_name,
      email: row.email,
      password_hash: row.password_hash,
      role: row.role,
      status: row.status,
      must_change_password: row.last_access === null,
      last_access: row.last_access ? row.last_access.toISOString() : null,
      created_at: row.creation_date ? row.creation_date.toISOString() : null,
      updated_at: row.updated_at ? row.updated_at.toISOString() : null,
    });
  }

  async findAll({ search, role, status, page = 1, per_page: perPage = 10 }) {
    const offset = (page - 1) * perPage;
    const conditions = [];
    const params = [];
    let paramIndex = 1;

    if (search) {
      conditions.push(
        `(LOWER(full_name) LIKE LOWER($${paramIndex}) OR LOWER(email) LIKE LOWER($${paramIndex}))`
      );
      params.push(`%${search}%`);
      paramIndex++;
    }

    if (role) {
      conditions.push(`role = $${paramIndex}`);
      params.push(role);
      paramIndex++;
    }

    if (status) {
      conditions.push(`status = $${paramIndex}`);
      params.push(status);
      paramIndex++;
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

    const countQuery = `SELECT COUNT(*) AS total FROM users ${whereClause}`;
    const countResult = await this.pool.query(countQuery, params);
    const totalRecords = parseInt(countResult.rows[0].total, 10);

    const dataQuery = `
      SELECT id_user, id_employee, full_name, email, role, status, creation_date, updated_at
      FROM users
      ${whereClause}
      ORDER BY id_user ASC
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `;
    params.push(perPage, offset);

    const dataResult = await this.pool.query(dataQuery, params);
    const users = dataResult.rows.map((row) => this.mapRowToEntity(row));

    return { users, total_records: totalRecords };
  }

  async findById(id) {
    const query = `
      SELECT id_user, id_employee, full_name, email, role, status,
             last_access, creation_date, updated_at
      FROM users
      WHERE id_user = $1
    `;
    const result = await this.pool.query(query, [id]);
    if (result.rows.length === 0) return null;
    return this.mapRowToEntity(result.rows[0]);
  }

  async findByEmail(email) {
    const query = `
      SELECT id_user, id_employee, full_name, email, password_hash, role,
             status, last_access, creation_date, updated_at
      FROM users
      WHERE LOWER(email) = LOWER($1)
    `;
    const result = await this.pool.query(query, [email]);
    if (result.rows.length === 0) return null;
    return this.mapRowToEntity(result.rows[0]);
  }

  async create({
    employee_id: employeeId,
    full_name: fullName,
    email,
    password_hash: passwordHash,
    role,
    status,
  }) {
    const query = `
      INSERT INTO users (
        id_employee, full_name, email, password_hash,
        role, status, creation_date, updated_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())
      RETURNING id_user, id_employee, full_name, email, role,
                status, last_access, creation_date, updated_at
    `;
    const values = [employeeId, fullName, email, passwordHash, role, status];
    const result = await this.pool.query(query, values);
    return this.mapRowToEntity(result.rows[0]);
  }

  async update(id, updates) {
    const setClauses = [];
    const params = [id];
    let paramIndex = 2;

    if (updates.full_name !== undefined) {
      setClauses.push(`full_name = $${paramIndex}`);
      params.push(updates.full_name);
      paramIndex++;
    }
    if (updates.email !== undefined) {
      setClauses.push(`email = $${paramIndex}`);
      params.push(updates.email);
      paramIndex++;
    }
    if (updates.role !== undefined) {
      setClauses.push(`role = $${paramIndex}`);
      params.push(updates.role);
      paramIndex++;
    }

    setClauses.push("updated_at = NOW()");

    const query = `
      UPDATE users
      SET ${setClauses.join(", ")}
      WHERE id_user = $1
      RETURNING id_user, id_employee, full_name, email, role,
                status, last_access, creation_date, updated_at
    `;
    const result = await this.pool.query(query, params);
    if (result.rows.length === 0) return null;
    return this.mapRowToEntity(result.rows[0]);
  }

  async updateStatus(id, status) {
    const query = `
      UPDATE users
      SET status = $2, updated_at = NOW()
      WHERE id_user = $1
      RETURNING id_user, status
    `;
    const result = await this.pool.query(query, [id, status]);
    return result.rows[0];
  }

  async updateCredentials(id, { password_hash: passwordHash, must_change_password: mustChange }) {
    const query = `
      UPDATE users
      SET password_hash = $2, last_access = CASE WHEN $3 THEN NULL ELSE last_access END, updated_at = NOW()
      WHERE id_user = $1
      RETURNING id_user
    `;
    const result = await this.pool.query(query, [id, passwordHash, mustChange]);
    return result.rows[0] || null;
  }

  async existsByEmployeeId(employeeId) {
    const result = await this.pool.query("SELECT 1 FROM users WHERE id_employee = $1 LIMIT 1", [
      employeeId,
    ]);
    return result.rows.length > 0;
  }

  async countActiveAdmins() {
    const query = `
      SELECT COUNT(*) AS total
      FROM users
      WHERE role = $1 AND status = $2
    `;
    const result = await this.pool.query(query, [UserRole.ADMIN, UserStatus.ACTIVE]);
    return parseInt(result.rows[0].total, 10);
  }

  async hasActiveRequests(userId) {
    const query = `
      SELECT COUNT(*) AS total
      FROM reservations_request
      WHERE logistic_user_id = $1 AND status = ANY($2::text[])
    `;
    const result = await this.pool.query(query, [
      userId,
      UserResponsibilityReservationRequestStatuses.map(toDatabaseStatus),
    ]);
    return parseInt(result.rows[0].total, 10) > 0;
  }

  async findAvailableLogisticsUsers() {
    const query = `
      SELECT id_user, id_employee, full_name
      FROM users
      WHERE role = $1 AND status = $2
      ORDER BY full_name ASC
    `;
    const result = await this.pool.query(query, [UserRole.LOGISTICS, UserStatus.ACTIVE]);
    return result.rows;
  }

  async findAssignedRequestsByUserId(userId) {
    const query = `
      SELECT id, folio, to_char(event_date, 'YYYY-MM-DD') AS event_date,
             to_char(event_time, 'HH24:MI') AS start_time,
             to_char(event_end_time AT TIME ZONE 'America/Merida', 'HH24:MI') AS end_time, status
      FROM reservations_request
      WHERE logistic_user_id = $1
      ORDER BY event_date ASC, event_time ASC
    `;
    const result = await this.pool.query(query, [userId]);
    return result.rows.map((r) => ({
      id: r.id,
      folio: r.folio,
      event_date: r.event_date,
      start_time: r.start_time,
      end_time: r.end_time,
      status: fromDatabaseStatus(r.status),
    }));
  }
}

module.exports = UserRepositoryImpl;
