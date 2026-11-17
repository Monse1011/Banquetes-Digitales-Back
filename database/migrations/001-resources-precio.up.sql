-- Defecto 4: tarifa por hora de los recursos humanos. Las filas existentes quedan en NULL
-- (cuestan 0 en la cotización, igual que hoy); la API exige precio > 0 al crear o editar.
BEGIN;

ALTER TABLE resources ADD COLUMN IF NOT EXISTS precio numeric(12,2);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'chk_resources_precio' AND conrelid = 'resources'::regclass
  ) THEN
    ALTER TABLE resources ADD CONSTRAINT chk_resources_precio CHECK (precio IS NULL OR precio > 0);
  END IF;
END $$;

COMMIT;
