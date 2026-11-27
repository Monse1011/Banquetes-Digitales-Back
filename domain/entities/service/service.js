class Service {
  // Dos formas de construcción conviven en el Incremento 4:
  //   (id, name, description, price, status) → gestión de la Función 2.6 (contratos 1 a 5).
  //   (id, name, description, status, price) → catálogo público de la Función 4.1 (contrato 12),
  //     que incluye estados legados ("activo"/"inactivo") y omite el precio en llamadas de 4
  //     argumentos. El orden se detecta por el tipo del cuarto argumento.
  constructor(id, name, description, priceOrStatus, statusOrPrice) {
    this.id = id;
    this.name = name;
    this.description = description;

    const normalizePrice = (value) =>
      value !== null && value !== undefined ? Number(value) : null;

    if (typeof priceOrStatus === "string") {
      this.status = priceOrStatus;
      this.price = normalizePrice(statusOrPrice);
    } else if (statusOrPrice !== undefined) {
      this.price = normalizePrice(priceOrStatus);
      this.status = statusOrPrice;
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
