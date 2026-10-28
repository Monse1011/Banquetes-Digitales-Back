const { Proposal } = require("../../../domain/entities/proposal/proposal");
const {
  ReservationRequestStatus,
} = require("../../../domain/enums/reservation-request/request-status");
const { ResourceType } = require("../../../domain/enums/resource/resource-type");
const { toDatabaseStatus } = require("../reservation-request/postgres-request-status");

// En la base de datos los tipos de recurso se guardan en español (Funciones 2.8 a 2.10).
const TYPE_BY_DB_TYPE = Object.freeze({
  humano: ResourceType.HUMAN,
  material: ResourceType.MATERIAL,
  logistico: ResourceType.LOGISTIC,
});

const PROPOSAL_SELECT = `SELECT id, request_id, derived_information_id, proposal_code, file_name,
    status, version, viewed_at, accepted_at, accepted_pdf_path, pdf_path, subtotal,
    discount_amount, total_amount, currency, client_observations, created_by_user_id, created_at`;

class PostgresProposalRepository {
  constructor(pool) {
    this.pool = pool;
  }

  async nextProposalCode(transaction = null) {
    const year = Number(
      new Intl.DateTimeFormat("en", {
        year: "numeric",
        timeZone: "America/Merida",
      }).format(new Date())
    );
    const result = await (transaction?.connection ?? this.pool).query(
      `INSERT INTO document_counters (kind, year, last_number)
       VALUES ('PROPOSAL_CODE', $1, 1)
       ON CONFLICT (kind, year) DO UPDATE
       SET last_number = document_counters.last_number + 1
       RETURNING last_number`,
      [year]
    );
    return `PROP-${year}-${String(result.rows[0].last_number).padStart(4, "0")}`;
  }

  // Incremento 3 (RF-3.4.4.1): cada generación crea una versión nueva; la mayor es la vigente.
  async nextVersion(requestId, transaction = null) {
    const result = await (transaction?.connection ?? this.pool).query(
      "SELECT COALESCE(MAX(version), 0) + 1 AS next FROM proposals WHERE request_id = $1",
      [requestId]
    );

    return Number(result.rows[0].next);
  }

  async createWithRequestStatus(
    proposal,
    requestId,
    expectedStatuses,
    resources = [],
    transaction = null
  ) {
    const connection = transaction?.connection ?? (await this.pool.connect());
    const ownsTransaction = !transaction?.connection;
    try {
      if (ownsTransaction) await connection.query("BEGIN");
      const update = await connection.query(
        `UPDATE reservations_request
         SET status = $1, status_changed_at = NOW()
         WHERE id = $2 AND status = ANY($3)`,
        [
          toDatabaseStatus(ReservationRequestStatus.PROPOSAL_GENERATED),
          requestId,
          expectedStatuses.map(toDatabaseStatus),
        ]
      );
      if (update.rowCount === 0) {
        if (ownsTransaction) await connection.query("ROLLBACK");
        return null;
      }
      const subtotal =
        proposal.subtotal ?? resources.reduce((sum, r) => sum + r.quantity * (r.unitCost ?? 0), 0);
      const discountAmount = proposal.discountAmount ?? 0;
      const version = await this.nextVersion(requestId, { connection });
      const result = await connection.query(
        `INSERT INTO proposals
         (request_id, derived_information_id, proposal_code, file_name, status, version,
          pdf_path, subtotal, discount_amount, total_amount, currency,
          client_observations, created_by_user_id, created_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14) RETURNING *`,
        [
          requestId,
          proposal.derivedInformationId,
          proposal.proposalsCode,
          proposal.name,
          proposal.status.toUpperCase(),
          version,
          proposal.name,
          subtotal,
          discountAmount,
          proposal.totalAmount ?? subtotal - discountAmount,
          proposal.currency ?? "MXN",
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
      if (ownsTransaction) await connection.query("COMMIT");
      return created;
    } catch (error) {
      if (ownsTransaction) await connection.query("ROLLBACK");
      throw error;
    } finally {
      if (ownsTransaction) connection.release();
    }
  }

  async findByRequestId(requestId) {
    return this.findCurrentByRequestId(requestId);
  }

  // RF-3.4.4.1: versión de mayor número = propuesta vigente.
  async findCurrentByRequestId(requestId, transaction = null) {
    const result = await (transaction?.connection ?? this.pool).query(
      `${PROPOSAL_SELECT} FROM proposals WHERE request_id = $1
       ORDER BY version DESC NULLS LAST, id DESC LIMIT 1`,
      [requestId]
    );
    return result.rows[0] ? this.toEntity(result.rows[0]) : null;
  }

  // RF-3.4.4.3: líneas de recursos con el costo unitario congelado de la propuesta.
  // description: nombre del rol operativo para humanos; nombre del recurso para el resto.
  async findResourcesByProposalId(proposalId, transaction = null) {
    const result = await (transaction?.connection ?? this.pool).query(
      `SELECT r.type, COALESCE(o.name, r.name) AS description, pr.quantity, pr.unit_cost
       FROM proposal_resources pr
       JOIN resources r ON r.id = pr.resource_id
       LEFT JOIN operative_roles o ON o.id = r.operative_role_id
       WHERE pr.proposal_id = $1`,
      [proposalId]
    );

    return result.rows.map((row) => ({
      type: TYPE_BY_DB_TYPE[row.type] ?? row.type,
      description: row.description,
      quantity: Number(row.quantity),
      unitCost: Number(row.unit_cost),
    }));
  }

  // RF-3.4.4.2: viewed_at se escribe una sola vez.
  async markViewed(proposalId, viewedAt, transaction = null) {
    const result = await (transaction?.connection ?? this.pool).query(
      "UPDATE proposals SET viewed_at = $2 WHERE id = $1 AND viewed_at IS NULL",
      [proposalId, viewedAt]
    );

    return result.rowCount > 0;
  }

  // RF-3.4.4.4.2 / RF-3.4.4.4.3: estado ACCEPTED con PDF de aceptación inalterable.
  async markAccepted(proposalId, acceptedAt, acceptedPdfPath, transaction = null) {
    const result = await (transaction?.connection ?? this.pool).query(
      `UPDATE proposals
       SET status = 'ACCEPTED', accepted_at = $2, accepted_pdf_path = $3
       WHERE id = $1 AND status = 'IN_REVIEW'`,
      [proposalId, acceptedAt, acceptedPdfPath]
    );

    return result.rowCount > 0;
  }

  async updateStatusAtomic(proposalId, expectedStatus, newStatus, transaction = null) {
    const result = await (transaction?.connection ?? this.pool).query(
      "UPDATE proposals SET status = $2 WHERE id = $1 AND status = $3",
      [proposalId, newStatus.toUpperCase(), expectedStatus.toUpperCase()]
    );

    return result.rowCount > 0;
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
      row.created_by_user_id === null ? null : Number(row.created_by_user_id),
      new Date(row.created_at),
      {
        requestId: row.request_id === null ? null : Number(row.request_id),
        version: row.version === null ? 1 : Number(row.version),
        viewedAt: row.viewed_at ? new Date(row.viewed_at) : null,
        acceptedAt: row.accepted_at ? new Date(row.accepted_at) : null,
        acceptedPdfPath: row.accepted_pdf_path ?? null,
        pdfPath: row.pdf_path ?? null,
        subtotal: row.subtotal === null ? null : Number(row.subtotal),
        discountAmount: row.discount_amount === null ? 0 : Number(row.discount_amount),
        totalAmount: row.total_amount === null ? null : Number(row.total_amount),
        currency: row.currency ?? "MXN",
      }
    );
  }
}
module.exports = { PostgresProposalRepository };
