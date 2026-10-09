class GetInventoryResourceResponseDto {
  constructor(id, name, type, quantity, unitCost, isActive, createdAt, updatedAt, deactivatedAt) {
    this.data = {
      resource: {
        id,
        name,
        type,
        quantity,
        unit_cost: unitCost,
        is_active: isActive,
        created_at: createdAt,
        updated_at: updatedAt,
        deactivated_at: deactivatedAt,
      },
    };
  }
}

module.exports = GetInventoryResourceResponseDto;
