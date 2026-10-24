const {
  ResourceAssignment,
} = require("../../../domain/entities/resource-assignment/resource-assignment");
const {
  AssignmentStatus,
  BlockingAssignmentStatuses,
} = require("../../../domain/enums/resource-assignment/assignment-status");
const {
  ResourceSufficiency,
} = require("../../../domain/enums/resource-assignment/resource-sufficiency");
const {
  blockingPeriod,
} = require("../../../application/services/resource-assignment/resource-availability");

const ASSIGNMENT_COLUMNS = `id, reservation_request_id, resource_id, quantity,
  requested_quantity, available_quantity, sufficiency, status, usage_start, usage_end,
  event_start, event_end, observation, created_by_user_id, created_at,
  confirmed_by_user_id, confirmed_at`;

class PostgresResourceAssignmentRepository {
  constructor(pool) {
    this.pool = pool;
  }

  async findByRequest(requestId, transaction = null) {
    const result = await this.executor(transaction).query(
      `SELECT ${ASSIGNMENT_COLUMNS}
       FROM assigned_resources
       WHERE reservation_request_id = $1 AND status = ANY($2)
       ORDER BY id`,
      [requestId, BlockingAssignmentStatuses]
    );
    return result.rows.map((row) => this.toEntity(row));
  }

  async findBlocking(resourceIds, period, excludeRequestId, transaction = null) {
    if (resourceIds.length === 0) return [];

    const result = await this.executor(transaction).query(
      `SELECT ${ASSIGNMENT_COLUMNS}
       FROM assigned_resources
       WHERE resource_id = ANY($1)
         AND reservation_request_id <> $2
         AND status = ANY($3)
         AND event_start < $4
         AND $5 < event_end + INTERVAL '3 hours'
       ORDER BY id`,
      [resourceIds, excludeRequestId, BlockingAssignmentStatuses, period.end, period.start]
    );
    return result.rows.map((row) => this.toEntity(row));
  }

  async saveProvisional(assignments, blocking, transaction = null) {
    return this.withTransaction(transaction, async (activeTransaction) => {
      const connection = this.executor(activeTransaction);
      const resourceIds = [...new Set(assignments.map((assignment) => assignment.resourceId))];
      await this.lockResources(connection, resourceIds);
      if (!(await this.isStillBlockedBy(connection, assignments, blocking))) return null;

      const requestId = assignments[0]?.requestId;
      if (requestId === undefined) return [];

      await connection.query(
        `UPDATE assigned_resources
         SET status = $1, updated_at = NOW()
         WHERE reservation_request_id = $2
           AND resource_id = ANY($3)
           AND status = $4`,
        [AssignmentStatus.RELEASED, requestId, resourceIds, AssignmentStatus.PROVISIONAL]
      );

      const saved = [];
      for (const assignment of assignments) {
        const result = await connection.query(
          `INSERT INTO assigned_resources
            (reservation_request_id, resource_id, quantity, requested_quantity,
             available_quantity, sufficiency, status, usage_start, usage_end,
             event_start, event_end, observation, created_by_user_id, created_at,
             confirmed_by_user_id, confirmed_at, updated_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, NOW())
           RETURNING ${ASSIGNMENT_COLUMNS}`,
          [
            assignment.requestId,
            assignment.resourceId,
            assignment.quantity,
            assignment.requestedQuantity,
            assignment.availableQuantity,
            assignment.sufficiency,
            assignment.status,
            assignment.usageStart,
            assignment.usageEnd,
            assignment.eventStart,
            assignment.eventEnd,
            assignment.observation,
            assignment.createdByUserId,
            assignment.createdAt,
            assignment.confirmedByUserId,
            assignment.confirmedAt,
          ]
        );
        saved.push(this.toEntity(result.rows[0]));
      }
      return saved;
    });
  }

  async confirm(assignments, releasedIds, blocking, transaction = null) {
    return this.withTransaction(transaction, async (activeTransaction) => {
      const connection = this.executor(activeTransaction);
      const resourceIds = [...new Set(assignments.map((assignment) => assignment.resourceId))];
      await this.lockResources(connection, resourceIds);
      if (!(await this.isStillBlockedBy(connection, assignments, blocking))) return null;

      for (const assignment of assignments) {
        if (assignment.id === null || assignment.id === undefined) {
          await this.insertConfirmedAssignment(connection, assignment);
        } else if (!(await this.updateConfirmedAssignment(connection, assignment))) {
          return null;
        }
      }

      if (releasedIds.length > 0) {
        await connection.query(
          `UPDATE assigned_resources
           SET status = $1, updated_at = NOW()
           WHERE id = ANY($2)`,
          [AssignmentStatus.RELEASED, releasedIds]
        );
      }
      return assignments;
    });
  }

  async releaseProvisional(requestId, transaction = null) {
    return this.withTransaction(transaction, async (activeTransaction) => {
      const result = await this.executor(activeTransaction).query(
        `UPDATE assigned_resources
         SET status = $1, updated_at = NOW()
         WHERE reservation_request_id = $2 AND status = $3
         RETURNING ${ASSIGNMENT_COLUMNS}`,
        [AssignmentStatus.RELEASED, requestId, AssignmentStatus.PROVISIONAL]
      );
      return result.rows.map((row) => this.toEntity(row));
    });
  }

  async releaseProvisionalResource(requestId, resourceId, transaction = null) {
    return this.withTransaction(transaction, async (activeTransaction) => {
      const result = await this.executor(activeTransaction).query(
        `UPDATE assigned_resources
         SET status = $1, updated_at = NOW()
         WHERE reservation_request_id = $2 AND resource_id = $3 AND status = $4
         RETURNING ${ASSIGNMENT_COLUMNS}`,
        [AssignmentStatus.RELEASED, requestId, resourceId, AssignmentStatus.PROVISIONAL]
      );
      return result.rows[0] ? this.toEntity(result.rows[0]) : null;
    });
  }

  assignmentValues(assignment) {
    return [
      assignment.requestId,
      assignment.resourceId,
      assignment.quantity,
      assignment.requestedQuantity,
      assignment.availableQuantity,
      assignment.sufficiency,
      assignment.status,
      assignment.usageStart,
      assignment.usageEnd,
      assignment.eventStart,
      assignment.eventEnd,
      assignment.observation,
      assignment.createdByUserId,
      assignment.createdAt,
      assignment.confirmedByUserId,
      assignment.confirmedAt,
    ];
  }

  async insertConfirmedAssignment(connection, assignment) {
    const result = await connection.query(
      `INSERT INTO assigned_resources
        (reservation_request_id, resource_id, quantity, requested_quantity,
         available_quantity, sufficiency, status, usage_start, usage_end,
         event_start, event_end, observation, created_by_user_id, created_at,
         confirmed_by_user_id, confirmed_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, NOW())
       RETURNING ${ASSIGNMENT_COLUMNS}`,
      this.assignmentValues(assignment)
    );
    Object.assign(assignment, this.toEntity(result.rows[0]));
  }

  async updateConfirmedAssignment(connection, assignment) {
    const result = await connection.query(
      `UPDATE assigned_resources
       SET quantity = $1, requested_quantity = $2, available_quantity = $3,
           sufficiency = $4, status = $5, usage_start = $6, usage_end = $7,
           event_start = $8, event_end = $9, observation = $10,
           created_by_user_id = $11, created_at = $12, confirmed_by_user_id = $13,
           confirmed_at = $14, updated_at = NOW()
       WHERE id = $15 AND reservation_request_id = $16
       RETURNING ${ASSIGNMENT_COLUMNS}`,
      [
        assignment.quantity,
        assignment.requestedQuantity,
        assignment.availableQuantity,
        assignment.sufficiency,
        assignment.status,
        assignment.usageStart,
        assignment.usageEnd,
        assignment.eventStart,
        assignment.eventEnd,
        assignment.observation,
        assignment.createdByUserId,
        assignment.createdAt,
        assignment.confirmedByUserId,
        assignment.confirmedAt,
        assignment.id,
        assignment.requestId,
      ]
    );
    if (!result.rows[0]) return false;
    Object.assign(assignment, this.toEntity(result.rows[0]));
    return true;
  }

  async lockResources(connection, resourceIds) {
    for (const resourceId of resourceIds.sort((left, right) => left - right)) {
      await connection.query("SELECT pg_advisory_xact_lock($1::bigint)", [resourceId]);
    }
  }

  async isStillBlockedBy(connection, assignments, blocking) {
    if (assignments.length === 0) return true;
    const { requestId, eventStart, eventEnd } = assignments[0];
    const resourceIds = [...new Set(assignments.map((assignment) => assignment.resourceId))];
    const period = blockingPeriod(eventStart, eventEnd);
    const currentResult = await connection.query(
      `SELECT id
       FROM assigned_resources
       WHERE resource_id = ANY($1)
         AND reservation_request_id <> $2
         AND status = ANY($3)
         AND event_start < $4
         AND $5 < event_end + INTERVAL '3 hours'
       ORDER BY id`,
      [resourceIds, requestId, BlockingAssignmentStatuses, period.end, period.start]
    );
    const currentIds = currentResult.rows.map((row) => Number(row.id)).sort((a, b) => a - b);
    const expectedIds = blocking.map((assignment) => assignment.id).sort((a, b) => a - b);
    return (
      currentIds.length === expectedIds.length &&
      currentIds.every((id, index) => id === expectedIds[index])
    );
  }

  executor(transaction) {
    return transaction?.connection ?? this.pool;
  }

  async withTransaction(transaction, work) {
    if (transaction?.connection) return work(transaction);

    const connection = await this.pool.connect();
    try {
      await connection.query("BEGIN");
      const result = await work({ connection });
      await connection.query("COMMIT");
      return result;
    } catch (error) {
      await connection.query("ROLLBACK");
      throw error;
    } finally {
      connection.release();
    }
  }

  toEntity(row) {
    return new ResourceAssignment(
      Number(row.id),
      Number(row.reservation_request_id),
      Number(row.resource_id),
      Number(row.quantity),
      Number(row.requested_quantity),
      Number(row.available_quantity),
      row.sufficiency ?? ResourceSufficiency.SUFFICIENT,
      row.status,
      new Date(row.usage_start),
      new Date(row.usage_end),
      new Date(row.event_start),
      new Date(row.event_end),
      row.observation,
      row.created_by_user_id === null ? null : Number(row.created_by_user_id),
      new Date(row.created_at),
      row.confirmed_by_user_id === null ? null : Number(row.confirmed_by_user_id),
      row.confirmed_at === null ? null : new Date(row.confirmed_at)
    );
  }
}

module.exports = { PostgresResourceAssignmentRepository };
