-- Datos semilla para desarrollo local.
BEGIN;

-- Catálogo de servicios (database/schema.sql §7, RF-3.4.2.3).
INSERT INTO services (id, name, status) VALUES
  (1, 'Banquetes y bebidas', 'ACTIVE'),
  (2, 'Barra de cocteles', 'ACTIVE'),
  (3, 'Decoración', 'ACTIVE'),
  (4, 'Música', 'ACTIVE'),
  (5, 'Fotografía', 'ACTIVE'),
  (6, 'Animación', 'ACTIVE'),
  (7, 'Servicio de personal', 'ACTIVE'),
  (8, 'Transporte', 'ACTIVE')
ON CONFLICT (id) DO NOTHING;
SELECT setval(pg_get_serial_sequence('services', 'id'), (SELECT MAX(id) FROM services));

INSERT INTO operative_roles (name) VALUES
  ('Chef'), ('Mesero'), ('Bartender'), ('Coordinador'), ('Ayudante de cocina')
ON CONFLICT (name) DO NOTHING;

-- Administrador General. Empleado: 001 · Contraseña temporal: Admin123!
-- last_access NULL => primer acceso: el sistema obliga a cambiar la contraseña.
INSERT INTO users (id_employee, full_name, email, password_hash, role, status)
VALUES ('001', 'Administrador General', 'admin@banquetes.com',
        '$2b$10$KBdBQiiTGxES5Kcc2q.jZuIy5sFVNEzdzyRmztp0THqg9Z30TLQOu', 'ADMIN', 'ACTIVE')
ON CONFLICT (id_employee) DO NOTHING;

-- Recursos de ejemplo para probar la confirmación de recursos.
INSERT INTO resources (name, type, operative_role_id, total_quantity, unit_cost) VALUES
  ('Ana López', 'HUMAN', (SELECT id FROM operative_roles WHERE name = 'Mesero'), 1, 800),
  ('Carlos Méndez', 'HUMAN', (SELECT id FROM operative_roles WHERE name = 'Mesero'), 1, 800),
  ('Lucía Pech', 'HUMAN', (SELECT id FROM operative_roles WHERE name = 'Chef'), 1, 1500),
  ('Jorge Canché', 'HUMAN', (SELECT id FROM operative_roles WHERE name = 'Bartender'), 1, 900),
  ('Vajilla completa', 'MATERIAL', NULL, 300, 25),
  ('Mesa redonda para 10 personas', 'MATERIAL', NULL, 40, 150),
  ('Silla Tiffany', 'MATERIAL', NULL, 400, 35),
  ('Mantelería fina', 'MATERIAL', NULL, 60, 90),
  ('Camión de transporte', 'LOGISTIC', NULL, 2, 1500),
  ('Planta de luz', 'LOGISTIC', NULL, 1, 2200);

COMMIT;
