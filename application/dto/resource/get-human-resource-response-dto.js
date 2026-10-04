class GetHumanResourceResponseDto {
  constructor(id, name, type, operativeRoleId, isActive, createdAt, updatedAt, deactivatedAt) {
    this.data = {
      resource: {
        id,
        name,
        type,
        operative_role_id: operativeRoleId,
        is_active: isActive,
        created_at: createdAt,
        updated_at: updatedAt,
        deactivated_at: deactivatedAt,
      },
    };
  }
}

module.exports = GetHumanResourceResponseDto;
