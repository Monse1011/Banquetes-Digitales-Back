const { Proposal } = require("../../../domain/entities/proposal/proposal");
const {
  ReservationRequestStatus,
} = require("../../../domain/enums/reservation-request/request-status");

class PostgresProposalRepository {
  constructor(pool) {
    this.pool = pool;
  }

  // RF-2.3.4.4: el folio de la propuesta es único, consecutivo e inmutable.
  async nextProposalCode() {
    const year = new Date().getFullYear();
    const prefix = `PROP-${year}-`;
    const result = await this.pool.query(
      `SELECT COALESCE(
          MAX(CAST(SUBSTRING(proposals_code FROM 'PROP-[0-9]{4}-([0-9]+)') AS BIGINT)),
          0
        ) + 1 AS next_sequence
       FROM proposals
       WHERE proposals_code LIKE $1`,
      [`${prefix}%`]
    );
    const sequence = Number(result.rows[0].next_sequence);

    return `${prefix}${String(sequence).padStart(4, "0")}`;
  }

  // RF-2.3.4.5: registro de la propuesta y cambio de estado de la solicitud en
  // una sola operación. Devuelve null si el estado esperado ya no coincide.
  async createWithRequestStatus(proposal, requestId, expectedStatuses) {
    const connection = await this.pool.connect();

    try {
      await connection.query("BEGIN");

      const updateResult = await connection.query(
        `UPDATE reservations_request
         SET status = $1
         WHERE id_reservation_request = $2 AND status = ANY($3)`,
        [ReservationRequestStatus.PROPOSAL_GENERATED, requestId, expectedStatuses]
      );

      if (updateResult.rowCount === 0) {
        await connection.query("ROLLBACK");
        return null;
      }

      const result = await connection.query(
        `INSERT INTO proposals
          (derived_information_id, proposals_code, name, creation_date, status,
           client_observations, created_by_user_id)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING id, derived_information_id, proposals_code, name, creation_date,
           status, client_observations, created_by_user_id, created_at`,
        [
          proposal.derivedInformationId,
          proposal.proposalsCode,
          proposal.name,
          proposal.creationDate,
          proposal.status,
          proposal.clientObservations,
          proposal.createdByUserId,
        ]
      );
      const created = this.toEntity(result.rows[0]);

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
      `SELECT p.id, p.derived_information_id, p.proposals_code, p.name,
        p.creation_date, p.status, p.client_observations, p.created_by_user_id,
        p.created_at
       FROM proposals p
       JOIN derived_information di ON di.id = p.derived_information_id
       WHERE di.event_request_id = $1
       ORDER BY p.id DESC
       LIMIT 1`,
      [requestId]
    );

    return result.rows[0] ? this.toEntity(result.rows[0]) : null;
  }

  toEntity(row) {
    return new Proposal(
      Number(row.id),
      Number(row.derived_information_id),
      row.proposals_code,
      row.name,
      new Date(row.creation_date),
      row.status,
      row.client_observations,
      row.created_by_user_id === null ? null : Number(row.created_by_user_id),
      new Date(row.created_at)
    );
  }
}

module.exports = { PostgresProposalRepository };
