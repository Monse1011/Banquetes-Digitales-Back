// Datos mínimos para las pruebas del esquema. Todo se inserta dentro de una transacción que
// se revierte (withRollback), así que no queda nada en la BD de pruebas.

async function withRollback(pool, work) {
  const db = await pool.connect();
  try {
    await db.query("BEGIN");
    return await work(db);
  } finally {
    await db.query("ROLLBACK");
    db.release();
  }
}

// Ejecuta una sentencia que debe fallar y devuelve el error de PostgreSQL. El SAVEPOINT evita
// que el fallo aborte la transacción de la prueba.
async function pgError(db, sql, params = []) {
  await db.query("SAVEPOINT expected_error");
  const error = await db.query(sql, params).then(
    () => null,
    (failure) => failure
  );
  await db.query("ROLLBACK TO SAVEPOINT expected_error");
  return error;
}

// Grafo con una fila de cada entidad principal; las tablas de detalle las crea cada prueba.
async function seedGraph(db) {
  const id = async (sql, params = []) => Number((await db.query(sql, params)).rows[0].id);

  const admin = await id(
    `INSERT INTO users (id_employee, full_name, email, password_hash, role)
     VALUES ('FX-A', 'Admin FX', 'fx-admin@example.invalid', 'x', 'ADMIN') RETURNING id_user AS id`
  );
  const logistic = await id(
    `INSERT INTO users (id_employee, full_name, email, password_hash, role)
     VALUES ('FX-L', 'Logistica FX', 'fx-log@example.invalid', 'x', 'LOGISTICS') RETURNING id_user AS id`
  );
  const client = await id(
    `INSERT INTO clients (full_name, email, phone)
     VALUES ('Cliente FX', 'fx-client@example.invalid', '9991234567') RETURNING id`
  );
  const service = await id("INSERT INTO services (name) VALUES ('Servicio FX') RETURNING id");
  const role = await id("INSERT INTO operative_roles (name) VALUES ('Rol FX') RETURNING id");
  const human = await id(
    `INSERT INTO resources (name, type, operative_role_id, total_quantity)
     VALUES ('Mesero FX', 'HUMAN', $1, 5) RETURNING id`,
    [role]
  );
  const material = await id(
    `INSERT INTO resources (name, type, total_quantity, unit_cost)
     VALUES ('Sillas FX', 'MATERIAL', 100, 12.5) RETURNING id`
  );
  // 18:00 en Mérida (UTC-6) = 00:00 UTC del día siguiente.
  const request = await id(
    `INSERT INTO reservations_request
       (folio, client_id, event_date, event_time, event_end_time, guest_count, event_address,
        status, logistic_user_id, assigned_by_user_id, assigned_at)
     VALUES ('BD-2099-00001', $1, '2099-06-01', '18:00', '2099-06-02T05:00:00Z', 80, 'Salon FX',
        'ASSIGNED', $2, $3, now()) RETURNING id`,
    [client, logistic, admin]
  );
  const derived = await id(
    `INSERT INTO derived_information (request_id, location, start_datetime, end_datetime,
       created_by_user_id)
     VALUES ($1, 'Salon FX', '2099-06-02T00:00:00Z', '2099-06-02T05:00:00Z', $2) RETURNING id`,
    [request, logistic]
  );
  const proposal = await id(
    `INSERT INTO proposals (request_id, derived_information_id, proposal_code, file_name, status,
       subtotal, total_amount, created_by_user_id)
     VALUES ($1, $2, 'PROP-2099-0001', 'prop.pdf', 'IN_REVIEW', 125, 125, $3) RETURNING id`,
    [request, derived, logistic]
  );
  const event = await id(
    `INSERT INTO calendar_events (id_request, title, start_at, end_at, location)
     VALUES ($1, 'Evento FX', '2099-06-02T00:00:00Z', '2099-06-02T05:00:00Z', 'Salon FX')
     RETURNING id`,
    [request]
  );

  return {
    admin,
    logistic,
    client,
    service,
    role,
    human,
    material,
    request,
    derived,
    proposal,
    event,
  };
}

module.exports = { withRollback, pgError, seedGraph };
