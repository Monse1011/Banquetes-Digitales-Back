-- =============================================================================
-- Seed de DEMOSTRACIÓN del Incremento 4 (funciones 2.15 y 4.1) para pruebas
-- manuales contra la BD de desarrollo. Idempotente: si ya corrió, no duplica.
-- Requiere database/schema.sql aplicado (catálogo services y promotions con
-- filas; los seeds del esquema bastan).
--   psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f database/seed-demo-inc4.sql
-- =============================================================================

BEGIN;

DO $$
DECLARE
  v_logistica bigint;
  v_ana bigint; v_luis bigint; v_carla bigint;
  v_s_basico integer; v_s_premium integer; v_s_deco integer; v_s_musica integer;
  v_p_10 bigint; v_p_msi bigint;
  v_r1 bigint; v_r2 bigint; v_r3 bigint; v_r4 bigint; v_r5 bigint; v_r6 bigint;
  v_d4 bigint; v_d5 bigint;
BEGIN
  IF EXISTS (SELECT 1 FROM reservations_request WHERE folio = 'BD-2026-90001') THEN
    RAISE NOTICE 'seed-demo-inc4: ya estaba aplicado; no se inserta nada';
    RETURN;
  END IF;

  SELECT id_user INTO v_logistica FROM users WHERE role = 'LOGISTICS' ORDER BY id_user LIMIT 1;

  INSERT INTO clients (full_name, email, phone)
  VALUES ('Ana López Demo', 'ana.demo@example.invalid', '9991110001') RETURNING id INTO v_ana;
  INSERT INTO clients (full_name, email, phone)
  VALUES ('Luis Pérez Demo', 'luis.demo@example.invalid', '9991110002') RETURNING id INTO v_luis;
  INSERT INTO clients (full_name, email, phone)
  VALUES ('Carla Ruiz Demo', 'carla.demo@example.invalid', '9991110003') RETURNING id INTO v_carla;

  SELECT id INTO v_s_basico  FROM services WHERE name = 'Banquete Básico'      LIMIT 1;
  SELECT id INTO v_s_premium FROM services WHERE name = 'Banquete Premium'     LIMIT 1;
  SELECT id INTO v_s_deco    FROM services WHERE name = 'Decoración Floral'    LIMIT 1;
  SELECT id INTO v_s_musica  FROM services WHERE name = 'Servicio de Música'   LIMIT 1;

  SELECT id INTO v_p_10 FROM promotions WHERE name = 'Primer banquete con 10% de descuento' LIMIT 1;
  SELECT id INTO v_p_msi FROM promotions WHERE name = '3 meses sin intereses' LIMIT 1;

  -- R1 y R2: recibidas en octubre 2026 (gráfica de barras por día con ceros).
  INSERT INTO reservations_request (folio, client_id, logistic_user_id, event_date, event_time,
    guest_count, event_address, status, request_date)
  VALUES ('BD-2026-90001', v_ana, v_logistica, '2026-11-14', '18:00', 80,
    'Hacienda Temozón', 'PENDING', '2026-10-03T10:15:00-06:00') RETURNING id INTO v_r1;
  INSERT INTO reservations_request (folio, client_id, logistic_user_id, event_date, event_time,
    guest_count, event_address, status, request_date)
  VALUES ('BD-2026-90002', v_luis, v_logistica, '2026-12-02', '20:00', 150,
    'Salón Montejo', 'APPROVED', '2026-10-05T16:40:00-06:00') RETURNING id INTO v_r2;

  -- R3: CONFIRMED en noviembre (entra a SERVICES).
  INSERT INTO reservations_request (folio, client_id, logistic_user_id, event_date, event_time,
    guest_count, event_address, status, request_date)
  VALUES ('BD-2026-90003', v_ana, v_logistica, '2027-01-10', '19:00', 60,
    'Quinta Azules', 'CONFIRMED', '2026-11-01T09:00:00-06:00') RETURNING id INTO v_r3;

  -- R4 y R5: FINALIZED (EVENTS). Su fecha vigente sale de derived_information:
  -- R4 se movió a diciembre 2026 y R5 a enero 2027.
  INSERT INTO reservations_request (folio, client_id, logistic_user_id, event_date, event_time,
    guest_count, event_address, status, request_date)
  VALUES ('BD-2026-90004', v_carla, v_logistica, '2026-12-03', '18:00', 120,
    'Jardín Canek', 'FINALIZED', '2026-09-12T12:00:00-06:00') RETURNING id INTO v_r4;
  INSERT INTO reservations_request (folio, client_id, logistic_user_id, event_date, event_time,
    guest_count, event_address, status, request_date)
  VALUES ('BD-2026-90005', v_luis, v_logistica, '2027-01-20', '21:00', 200,
    'Hacienda Temozón', 'FINALIZED', '2026-08-20T11:00:00-06:00') RETURNING id INTO v_r5;

  -- R6: antigua y rechazada (solo REQUESTS la ve).
  INSERT INTO reservations_request (folio, client_id, event_date, event_time, guest_count,
    event_address, status, request_date)
  VALUES ('BD-2026-90006', v_ana, '2025-10-01', '18:00', 40,
    'Salón Montejo', 'REJECTED', '2025-09-01T10:00:00-06:00') RETURNING id INTO v_r6;

  -- Servicios contratados con sus copias congeladas.
  INSERT INTO request_services (request_id, service_id, service_name_snapshot,
    service_description_snapshot, service_price_snapshot)
  VALUES
    (v_r1, v_s_basico,  'Banquete Básico',   'Menú de 2 tiempos', 1500),
    (v_r2, v_s_premium, 'Banquete Premium',  'Menú de 3 tiempos', 2500),
    (v_r2, v_s_deco,    'Decoración Floral', 'Flores y mantelería', 900),
    (v_r3, v_s_basico,  'Banquete Básico',   'Menú de 2 tiempos', 1500),
    (v_r3, v_s_musica,  'Servicio de Música','DJ y sonido', 1200),
    (v_r4, v_s_premium, 'Banquete Premium',  'Menú de 3 tiempos', 2500),
    (v_r4, v_s_deco,    'Decoración Floral', 'Flores y mantelería', 900),
    (v_r5, v_s_basico,  'Banquete Básico',   'Menú de 2 tiempos', 1500),
    (v_r6, v_s_deco,    'Decoración Floral', 'Flores y mantelería', 900);

  -- Acuerdos vigentes de los eventos finalizados (la fecha vigente del reporte
  -- debe salir de aquí, no de event_date).
  INSERT INTO derived_information (request_id, location, start_datetime, end_datetime)
  VALUES (v_r4, 'Jardín Canek (movido)', '2026-12-05T18:00:00-06:00', '2026-12-05T23:00:00-06:00')
    RETURNING id INTO v_d4;
  INSERT INTO derived_information (request_id, location, start_datetime, end_datetime)
  VALUES (v_r5, 'Hacienda Temozón (movida)', '2027-01-23T19:00:00-06:00', '2027-01-23T23:30:00-06:00')
    RETURNING id INTO v_d5;

  -- Propuestas ACCEPTED con promoción aplicada (alimentan EVENTS.promotion y PROMOTIONS).
  INSERT INTO proposals (request_id, derived_information_id, proposal_code, file_name, status,
    subtotal, discount_amount, total_amount, accepted_at, promotion_id, promotion_name_snapshot,
    promotion_description_snapshot, promotion_discount_snapshot)
  VALUES
    (v_r4, v_d4, 'PROP-DEMO-0001', 'prop-90004.pdf', 'ACCEPTED', 3400, 170, 3230, now(),
     v_p_10, 'Primer banquete con 10% de descuento',
     'Descuento del 10% en tu primer banquete con nosotros.', 10.00),
    (v_r5, v_d5, 'PROP-DEMO-0002', 'prop-90005.pdf', 'ACCEPTED', 1500, 0, 1500, now(),
     v_p_msi, '3 meses sin intereses',
     'Diferido a 3 meses sin intereses con tarjetas participantes.', 5.00);
END $$;

COMMIT;

-- Resultado esperado:
--   REQUESTS: 6 solicitudes (2 en oct-2026, 1 en nov-2026, 1 en sep-2026, 1 en ago-2026, 1 en sep-2025)
--   EVENTS: 2 (fechas VIGENTES 2026-12-05 y 2027-01-23 — movidas por derived_information,
--            distintas al event_date original —, cada una con su promoción aplicada)
--   SERVICES: Banquete Básico 2, Premium 1, Decoración 1, Música 1 (total 5 contrataciones;
--            solo CONFIRMED/FINALIZED: R3, R4 y R5)
--   PROMOTIONS: 3 meses sin intereses 1 uso, Primer banquete 10% 1 uso (gráfica de barras)
-- Opcional para ver el sufijo "(No vigente)" en SERVICES:
--   UPDATE services SET status = 'INACTIVE' WHERE name = 'Servicio de Música';
