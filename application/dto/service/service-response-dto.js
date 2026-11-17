class ServiceResponseDto {
  static fromEntity(service) {
    if (!service) return null;

    return {
      id: Number(service.id),
      name: service.name,
      description: service.description,
      price: service.price !== null && service.price !== undefined ? Number(service.price) : null,
      status: service.status,
    };
  }

  static fromEntities(services = []) {
    return services.map((service) => ServiceResponseDto.fromEntity(service));
  }
}

module.exports = ServiceResponseDto;

