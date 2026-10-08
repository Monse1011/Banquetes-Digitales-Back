class Resource {
  constructor(
    id,
    name,
    type,
    operativeRoleId,
    totalQuantity,
    unitCost,
    isActive,
    createdAt,
    updatedAt,
    deactivatedAt,
    version = 0
  ) {
    this.id = id;
    this.name = name;
    this.type = type;
    this.operativeRoleId = operativeRoleId;
    this.totalQuantity = totalQuantity;
    this.unitCost = unitCost;
    this.isActive = isActive;
    this.createdAt = createdAt;
    this.updatedAt = updatedAt;
    this.deactivatedAt = deactivatedAt;
    // Control de concurrencia optimista: aumenta con cada modificación guardada.
    this.version = version;
  }

  // RF-1.2.8.3: la eliminación es lógica.
  deactivate(now) {
    this.isActive = false;
    this.deactivatedAt = now;
    this.updatedAt = now;
  }

  activate(now) {
    this.isActive = true;
    this.deactivatedAt = null;
    this.updatedAt = now;
  }
}

module.exports = { Resource };
