const {
  availableQuantity,
  blockingPeriod,
} = require("../../services/resource-assignment/resource-availability");
const {
  ResourceSufficiency,
} = require("../../../domain/enums/resource-assignment/resource-sufficiency");
const {
  AssignedResourceStatus,
} = require("../../../domain/enums/proposal/assigned-resource-status");
const { AdminRequestMessages } = require("../../../domain/constants/admin-request-messages");

// GET /api/admin/requests/{request_id} (DAD v3.0): ficha de solo lectura de una solicitud
// (RF-1.2.4.2, RF-1.2.5.3 y RF-1.2.11.2).
class GetReservationRequestUseCase {
  constructor(adminRequestQueryRepository) {
    this.adminRequestQueryRepository = adminRequestQueryRepository;
  }

  async execute(id) {
    const found = await this.adminRequestQueryRepository.findById(id);

    if (!found) {
      const error = new Error(AdminRequestMessages.REQUEST_NOT_FOUND);
      error.status = 404;
      throw error;
    }

    const { request, assignments, currentStart, currentEnd } = found;
    const blocking = await this.adminRequestQueryRepository.findBlockingAssignments(
      assignments.map((assignment) => assignment.id),
      request.request_id
    );
    const period = blockingPeriod(currentStart, currentEnd ?? currentStart);
    const resourceAssignments = { human: [], material: [], logistic: [] };

    assignments.forEach((assignment) => {
      resourceAssignments[assignment.type.toLowerCase()].push({
        id: assignment.id,
        name: assignment.name,
        type: assignment.type,
        ...(assignment.type === "HUMAN"
          ? {
              operative_role_id: assignment.operative_role_id,
              operative_role: assignment.operative_role,
            }
          : {}),
        assignment: {
          requested_quantity: assignment.requested_quantity,
          assigned_quantity: assignment.quantity,
          available_quantity: availableQuantity(
            {
              id: assignment.id,
              isActive: assignment.is_active,
              totalQuantity: assignment.total_quantity,
            },
            blocking,
            period
          ),
          sufficiency: ResourceSufficiency[assignment.sufficiency],
          status: AssignedResourceStatus[assignment.status],
          observation: assignment.observation,
        },
      });
    });

    return { data: { ...request, resource_assignments: resourceAssignments } };
  }
}

module.exports = { GetReservationRequestUseCase };
