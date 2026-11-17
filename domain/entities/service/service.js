class Service {
  constructor(id, name, description, status, price = null) {
    this.id = id;
    this.name = name;
    this.description = description;
    this.status = status;
    this.price = price;
  }
}

module.exports = { Service };
