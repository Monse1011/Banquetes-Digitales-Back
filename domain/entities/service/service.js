class Service {
  constructor(id, name, description, priceOrStatus, status) {
    this.id = id;
    this.name = name;
    this.description = description;

    if (status !== undefined) {
      this.price =
        priceOrStatus !== null && priceOrStatus !== undefined ? Number(priceOrStatus) : null;
      this.status = status;
    } else if (typeof priceOrStatus === "number") {
      this.price = priceOrStatus;
      this.status = "ACTIVE";
    } else {
      this.price = null;
      this.status = priceOrStatus;
    }
  }
}

module.exports = { Service };
