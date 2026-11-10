// Galería pública (Función 4.1, AD-05): listado completo ordenado por position, id.
class PostgresGalleryRepository {
  constructor(pool) {
    this.pool = pool;
  }

  async listOrdered() {
    const result = await this.pool.query(
      `SELECT id, url, title, alt
         FROM gallery_photos
        ORDER BY position, id`
    );

    return result.rows.map((row) => ({
      id: Number(row.id),
      url: row.url,
      title: row.title,
      alt: row.alt,
    }));
  }
}

module.exports = { PostgresGalleryRepository };
