const { ResourceType } = require("../../../domain/enums/resource/resource-type");
const { ResourceSortField } = require("../../../domain/enums/resource/resource-sort-field");
const RequestResourcesAvailabilityResponseDto = require("../../dto/resource-assignment/request-resources-availability-response-dto");
const { toSummaryDto } = require("../resource/get-resources-use-case");
const {
  findConfirmableRequest,
} = require("../../services/resource-assignment/request-access-guard");
const {
  blockingPeriod,
  availableQuantity,
} = require("../../services/resource-assignment/resource-availability");

// La provisional de la sesión reemplaza a la confirmada del mismo recurso (RF-2.3.2.19).
function currentAssignmentsByResource(assignments) {
  const byResource = new Map();

  assignments.forEach((assignment) => {
    const current = byResource.get(assignment.resourceId);

    if (!current || assignment.isProvisional) {
      byResource.set(assignment.resourceId, assignment);
    }
  });

  return byResource;
}

// Función 3.2 - RF-2.3.2.5: listas de recursos activos de un tipo con la cantidad disponible
// para el periodo del evento de la solicitud. Una instancia sirve para los tres tipos.
class GetRequestResourcesAvailabilityUseCase {
  constructor(
    resourceRepository,
    reservationRequestRepository,
    resourceAssignmentRepository,
    operativeRoleRepository
  ) {
    this.resourceRepository = resourceRepository;
    this.reservationRequestRepository = reservationRequestRepository;
    this.resourceAssignmentRepository = resourceAssignmentRepository;
    this.operativeRoleRepository = operativeRoleRepository;
  }

  async execute(requestId, user, type, input = {}) {
    const request = await findConfirmableRequest(
      this.reservationRequestRepository,
      requestId,
      user
    );
    const page = input.page ?? 1;
    const perPage = input.perPage ?? 10;
    const sort = input.sort ?? { field: ResourceSortField.NAME, direction: "asc" };
    // RF-1.2.8.3: los recursos inactivos no aparecen como disponibles.
    const filters = { ...input.filters, isActive: true, type };
    const { resources, totalRecords } = await this.resourceRepository.findAll(
      filters,
      sort,
      page,
      perPage
    );

    const period = blockingPeriod(request.eventDateTime, request.eventEndTime);
    const { assignments } = await this.resourceAssignmentRepository.findBlocking(
      resources.map((resource) => resource.id),
      period,
      request.requestId
    );
    const requestAssignments = currentAssignmentsByResource(
      await this.resourceAssignmentRepository.findActiveByRequest(request.requestId)
    );
    const operativeRoles = await this.operativeRoleNames(resources);

    const items = resources.map((resource) => ({
      summary: toSummaryDto(resource),
      operativeRole:
        resource.type === ResourceType.HUMAN
          ? (operativeRoles.get(resource.operativeRoleId) ?? null)
          : undefined,
      available: availableQuantity(resource, assignments, period),
      assignment: requestAssignments.get(resource.id) ?? null,
    }));

    return new RequestResourcesAvailabilityResponseDto(
      items,
      totalRecords,
      page,
      perPage,
      request,
      await this.observations(request.requestId)
    );
  }

  // RF-2.3.2.7: los recursos humanos se eligen por el rol operativo requerido.
  async operativeRoleNames(resources) {
    const roleIds = [
      ...new Set(
        resources
          .filter((resource) => resource.operativeRoleId !== null)
          .map((resource) => resource.operativeRoleId)
      ),
    ];
    const roles = await Promise.all(
      roleIds.map((roleId) => this.operativeRoleRepository.findById(roleId))
    );

    return new Map(roles.filter(Boolean).map((role) => [role.id, role.name]));
  }

  async observations(requestId) {
    const confirmation = await this.resourceAssignmentRepository.findLatestConfirmation(requestId);

    return {
      confirmed: confirmation?.observations ?? null,
      pending: await this.resourceAssignmentRepository.findPendingObservations(requestId),
    };
  }
}

module.exports = { GetRequestResourcesAvailabilityUseCase, currentAssignmentsByResource };
