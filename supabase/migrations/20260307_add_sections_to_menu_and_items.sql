-- Soporte de secciones por menú
-- 1) Tabla de secciones por menú
-- 2) Columna seccion en items

BEGIN;

CREATE TABLE IF NOT EXISTS public.menu_sections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  menu_id uuid NOT NULL REFERENCES public.menus(id) ON DELETE CASCADE,
  nombre text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_menu_sections_menu_nombre_unique
  ON public.menu_sections (menu_id, lower(nombre));

ALTER TABLE public.items
  ADD COLUMN IF NOT EXISTS seccion text;

ALTER TABLE public.items
  ADD COLUMN IF NOT EXISTS activo boolean NOT NULL DEFAULT true;

CREATE INDEX IF NOT EXISTS idx_items_seccion ON public.items (seccion);

COMMIT;
