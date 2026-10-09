const { AssignedResource } = require("../../../domain/entities/proposal/assigned-resource");
const {
  AssignedResourceStatus,
  ActiveAssignedResourceStatuses,
} = require("../../../domain/enums/proposal/assigned-resource-status");
const { ResourceType } = require("../../../domain/enums/resource/resource-type");
const { blockingEnd } = require("../../../application/services/proposal/schedule-window");

// En la base de datos los tipos se guardan en español (Funciones 2.8 a 2.10).
const DB_TYPE_BY_TYPE = Object.freeze({
  [ResourceType.HUMAN]: "humano",
  [ResourceType.MATERIAL]: "material",
  [ResourceType.LOGISTIC]: "logistico",
});

const TYPE_BY_DB_TYPE = Object.freeze({
  humano: ResourceType.HUMAN,
  material: ResourceType.MATERIAL,
  logistico: ResourceType.LOGISTIC,
});

class PostgresAssignedResourceRepository {
  constructor(pool) {
    this.pool = pool;
  }

  async findActiveByRequestId(requestId) {
    const result = await this.pool.query(
      `SELECT ar.id, ar.reservation_request_id, ar.resource_id, ar.quantity,
        ar.usage_start, ar.usage_end, ar.status, r.name, r.type, r.unit_cost
       FROM assigned_resources ar
       JOIN resources r ON r.id = ar.resource_id
       WHERE ar.reservation_request_id = $1 AND ar.status = ANY($2)
       ORDER BY r.name`,
      [requestId, ActiveAssignedResourceStatuses]
    );

    return result.rows.map((row) => this.toEntity(row));
  }

  // RF-2.3.4.8: disponibilidad del recurso para el periodo de bloqueo del horario
  // confirmado (duración + 3 horas, RF-2.3.2.13), excluyendo las asignaciones
  // propias de la solicitud en revisión.
  async findAvailability(resourceIds, start, end, excludeRequestId) {
    const result = await this.pool.query(
      `SELECT r.id AS resource_id, r.name, r.type, r.unit_cost, r.total_quantity,
        COALESCE(SUM(ar.quantity), 0)::int AS committed
       FROM resources r
       LEFT JOIN assigned_resources ar
         ON ar.resource_id = r.id
        AND ar.status = ANY($1)
        AND ar.reservation_request_id <> $2
        AND ar.usage_start < $3
        AND $4 < ar.usage_end + INTERVAL '3 hours'
       WHERE r.id = ANY($5)
       GROUP BY r.id`,
      [ActiveAssignedResourceStatuses, excludeRequestId, blockingEnd(end), start, resourceIds]
    );

    return result.rows.map((row) => {
      const totalQuantity = Number(row.total_quantity);
      const committed = Number(row.committed);

      return {
        resourceId: Number(row.resource_id),
        name: row.name,
        type: TYPE_BY_DB_TYPE[row.type] ?? row.type,
        unitCost: Number(row.unit_cost),
        totalQuantity,
        committed,
        available: totalQuantity - committed,
      };
    });
  }

  // RF-2.3.4.9: las cantidades ajustadas actualizan las asignaciones; las
  // reemplazadas y sobrantes quedan como "Liberada" en el historial.
  async syncAssignments(requestId, adjustments, usageStart, usageEnd) {
    const connection = await this.pool.connect();

    try {
      await connection.query("BEGIN");

      const activeResult = await connection.query(
        `SELECT id, resource_id, quantity
         FROM assigned_resources
         WHERE reservation_request_id = $1 AND status = ANY($2)
         FOR UPDATE`,
        [requestId, ActiveAssignedResourceStatuses]
      );
      const activeByResourceId = new Map(
        activeResult.rows.map((row) => [Number(row.resource_id), row])
      );

      for (const adjustment of adjustments) {
        const existing = activeByResourceId.get(adjustment.resourceId);
        const unchanged = existing && adjustment.quantity === Number(existing.quantity);

        if (unchanged) {
          // Solo aplica el traslado de periodo de bloqueo del final.
        } else {
          if (existing) {
            await connection.query(
              `UPDATE assigned_resources
               SET status = $1, updated_at = NOW()
               WHERE id = $2`,
              [AssignedResourceStatus.RELEASED, existing.id]
            );
          }

          if (adjustment.quantity > 0) {
            await this.insertAssignment(connection, requestId, adjustment, usageStart, usageEnd);
          }
        }
      }

      // El periodo de bloqueo vigente es el horario confirmado de la solicitud.
      await connection.query(
        `UPDATE assigned_resources
         SET usage_start = $2, usage_end = $3, updated_at = NOW()
         WHERE reservation_request_id = $1 AND status = ANY($4)`,
        [requestId, usageStart, usageEnd, ActiveAssignedResourceStatuses]
      );

      await connection.query("COMMIT");
    } catch (error) {
      await connection.query("ROLLBACK");
      throw error;
    } finally {
      connection.release();
    }
  }

  async insertAssignment(connection, requestId, adjustment, usageStart, usageEnd) {
    await connection.query(
      `INSERT INTO assigned_resources
        (reservation_request_id, resource_id, quantity, usage_start, usage_end, status)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [
        requestId,
        adjustment.resourceId,
        adjustment.quantity,
        usageStart,
        usageEnd,
        AssignedResourceStatus.CONFIRMED,
      ]
    );
  }

  toEntity(row) {
    return new AssignedResource(
      Number(row.id),
      Number(row.reservation_request_id),
      Number(row.resource_id),
      Number(row.quantity),
      new Date(row.usage_start),
      new Date(row.usage_end),
      row.status,
      row.name,
      TYPE_BY_DB_TYPE[row.type] ?? row.type,
      row.unit_cost === null ? null : Number(row.unit_cost)
    );
  }
}

module.exports = { PostgresAssignedResourceRepository, DB_TYPE_BY_TYPE };
