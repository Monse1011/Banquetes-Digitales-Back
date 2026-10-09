const { ResourceType } = require("../../../domain/enums/resource/resource-type");
const { ResourceSortField } = require("../../../domain/enums/resource/resource-sort-field");
const ResourceAvailabilityDto = require("../../dto/resource-assignment/resource-availability-dto");
const RequestResourcesAvailabilityResponseDto = require("../../dto/resource-assignment/request-resources-availability-response-dto");
const { toSummaryDto } = require("../resource/get-resources-use-case");
const {
  findConfirmableRequest,
} = require("../../services/resource-assignment/request-access-guard");
const {
  blockingPeriod,
  availableQuantity,
} = require("../../services/resource-assignment/resource-availability");
const {
  currentAssignmentsByResource,
} = require("../../services/resource-assignment/assignment-review");
const { formatDate, formatTime } = require("../../services/date-time-formatter");

// Función 3.2 - RF-2.3.2.5: recursos activos de un tipo con su cantidad disponible para el
// periodo del evento de la solicitud. Una instancia sirve para los tres tipos.
class GetRequestResourcesAvailabilityUseCase {
  constructor(
    resourceRepository,
    reservationRequestRepository,
    resourceAssignmentRepository,
    resourceConfirmationRepository,
    operativeRoleRepository
  ) {
    this.resourceRepository = resourceRepository;
    this.reservationRequestRepository = reservationRequestRepository;
    this.resourceAssignmentRepository = resourceAssignmentRepository;
    this.resourceConfirmationRepository = resourceConfirmationRepository;
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

    const result = await this.resourceRepository.findAll(filters, sort, page, perPage);
    const period = blockingPeriod(request.eventDateTime, request.eventEndTime);
    const blocking = await this.resourceAssignmentRepository.findBlocking(
      result.resources.map((resource) => resource.id),
      period,
      request.requestId
    );
    const requestAssignments = currentAssignmentsByResource(
      await this.resourceAssignmentRepository.findByRequest(request.requestId)
    );
    const operativeRoles = await this.findOperativeRoleNames(result.resources);
    const confirmation = await this.resourceConfirmationRepository.findLatestByRequest(
      request.requestId
    );

    return new RequestResourcesAvailabilityResponseDto(
      result.resources.map(
        (resource) =>
          new ResourceAvailabilityDto(
            toSummaryDto(resource),
            resource.type === ResourceType.HUMAN
              ? (operativeRoles.get(resource.operativeRoleId) ?? null)
              : undefined,
            availableQuantity(resource, blocking, period),
            requestAssignments.get(resource.id) ?? null
          )
      ),
      result.totalRecords,
      page,
      perPage,
      request.requestId,
      request.folio,
      request.status,
      formatDate(request.eventDateTime),
      formatTime(request.eventDateTime),
      formatTime(request.eventEndTime),
      confirmation?.observations ?? null,
      await this.resourceConfirmationRepository.findPendingObservations(request.requestId)
    );
  }

  // RF-2.3.2.7: los recursos humanos se eligen por el rol operativo requerido.
  async findOperativeRoleNames(resources) {
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
}

module.exports = { GetRequestResourcesAvailabilityUseCase };
