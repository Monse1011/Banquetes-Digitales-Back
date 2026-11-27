const { ProposalAdjustment } = require("../../../domain/entities/proposal/proposal-adjustment");

// Incremento 3 (RF-3.4.4.5.6): observaciones del cliente sobre una propuesta vigente.
class PostgresProposalAdjustmentRepository {
  constructor(pool) {
    this.pool = pool;
  }

  async create(adjustment, transaction = null) {
    const connection = transaction?.connection ?? this.pool;
    const result = await connection.query(
      `INSERT INTO proposal_adjustments (proposal_id, observations, created_at)
       VALUES ($1, $2, COALESCE($3, NOW()))
       RETURNING id, proposal_id, observations, created_at`,
      [adjustment.proposalId, adjustment.observations, adjustment.createdAt ?? null]
    );

    return this.toEntity(result.rows[0]);
  }

  // De la más reciente a la más antigua (RF-3.4.4.5.6).
  async findByRequestId(requestId, transaction = null) {
    const result = await (transaction?.connection ?? this.pool).query(
      `SELECT pa.id, pa.proposal_id, pa.observations, pa.created_at
       FROM proposal_adjustments pa
       JOIN proposals p ON p.id = pa.proposal_id
       WHERE p.request_id = $1
       ORDER BY pa.created_at DESC, pa.id DESC`,
      [requestId]
    );

    return result.rows.map((row) => this.toEntity(row));
  }

  toEntity(row) {
    return new ProposalAdjustment(
      Number(row.id),
      Number(row.proposal_id),
      row.observations,
      new Date(row.created_at)
    );
  }
}

module.exports = { PostgresProposalAdjustmentRepository };
