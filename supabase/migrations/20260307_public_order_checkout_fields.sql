-- Campos para checkout público + ticket + datos de orden en dashboard

BEGIN;

ALTER TABLE public.items
  ADD COLUMN IF NOT EXISTS precio numeric(10,2);

ALTER TABLE public.ordenes
  ADD COLUMN IF NOT EXISTS numero_orden integer,
  ADD COLUMN IF NOT EXISTS cliente_nombre text,
  ADD COLUMN IF NOT EXISTS tipo_servicio text,
  ADD COLUMN IF NOT EXISTS numero_mesa text;

CREATE INDEX IF NOT EXISTS idx_ordenes_restaurante_numero
  ON public.ordenes (restaurante_id, numero_orden);

CREATE UNIQUE INDEX IF NOT EXISTS idx_ordenes_restaurante_numero_unique
  ON public.ordenes (restaurante_id, numero_orden)
  WHERE numero_orden IS NOT NULL;

COMMIT;
