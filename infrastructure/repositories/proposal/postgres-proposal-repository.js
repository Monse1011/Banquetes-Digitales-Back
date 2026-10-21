const { Proposal } = require("../../../domain/entities/proposal/proposal");
const {
  ReservationRequestStatus,
} = require("../../../domain/enums/reservation-request/request-status");
const { toDatabaseStatus } = require("../reservation-request/postgres-request-status");

class PostgresProposalRepository {
  constructor(pool) {
    this.pool = pool;
  }

  async nextProposalCode() {
    const year = Number(
      new Intl.DateTimeFormat("en", {
        year: "numeric",
        timeZone: "America/Merida",
      }).format(new Date())
    );
    const result = await this.pool.query(
      `INSERT INTO document_counters (kind, year, last_number)
       VALUES ('PROPOSAL_CODE', $1, 1)
       ON CONFLICT (kind, year) DO UPDATE
       SET last_number = document_counters.last_number + 1
       RETURNING last_number`,
      [year]
    );
    return `PROP-${year}-${String(result.rows[0].last_number).padStart(4, "0")}`;
  }

  async createWithRequestStatus(proposal, requestId, expectedStatuses, resources = []) {
    const connection = await this.pool.connect();
    try {
      await connection.query("BEGIN");
      const update = await connection.query(
        "UPDATE reservations_request SET status = $1 WHERE id = $2 AND status = ANY($3)",
        [
          toDatabaseStatus(ReservationRequestStatus.PROPOSAL_GENERATED),
          requestId,
          expectedStatuses.map(toDatabaseStatus),
        ]
      );
      if (update.rowCount === 0) {
        await connection.query("ROLLBACK");
        return null;
      }
      const subtotal = resources.reduce((sum, r) => sum + r.quantity * (r.unitCost ?? 0), 0);
      const result = await connection.query(
        `INSERT INTO proposals
         (request_id, derived_information_id, proposal_code, file_name, status,
          subtotal, discount_amount, client_observations, created_by_user_id, created_at)
         VALUES ($1,$2,$3,$4,$5,$6,0,$7,$8,$9) RETURNING *`,
        [
          requestId,
          proposal.derivedInformationId,
          proposal.proposalsCode,
          proposal.name,
          proposal.status.toUpperCase(),
          subtotal,
          proposal.clientObservations,
          proposal.createdByUserId,
          proposal.creationDate,
        ]
      );
      const created = this.toEntity(result.rows[0]);
      for (const resource of resources.filter((r) => r.quantity > 0)) {
        await connection.query(
          `INSERT INTO proposal_resources (proposal_id, resource_id, quantity, unit_cost)
           VALUES ($1,$2,$3,$4)`,
          [created.id, resource.resourceId, resource.quantity, resource.unitCost ?? 0]
        );
      }
      await connection.query("COMMIT");
      return created;
    } catch (error) {
      await connection.query("ROLLBACK");
      throw error;
    } finally {
      connection.release();
    }
  }

  async findByRequestId(requestId) {
    const result = await this.pool.query(
      "SELECT * FROM proposals WHERE request_id = $1 ORDER BY id DESC LIMIT 1",
      [requestId]
    );
    return result.rows[0] ? this.toEntity(result.rows[0]) : null;
  }

  toEntity(row) {
    return new Proposal(
      Number(row.id),
      Number(row.derived_information_id),
      row.proposal_code,
      row.file_name,
      new Date(row.created_at),
      row.status.toLowerCase(),
      row.client_observations,
      Number(row.created_by_user_id),
      new Date(row.created_at)
    );
  }
}
module.exports = { PostgresProposalRepository };
