BEGIN;

CREATE TABLE IF NOT EXISTS public.stock_sections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurante_id uuid NOT NULL REFERENCES public.restaurantes(id) ON DELETE CASCADE,
  nombre text NOT NULL,
  fixed boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_stock_sections_restaurante_nombre_unique
  ON public.stock_sections (restaurante_id, lower(nombre));

CREATE TABLE IF NOT EXISTS public.stock_ingredients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurante_id uuid NOT NULL REFERENCES public.restaurantes(id) ON DELETE CASCADE,
  section_id uuid REFERENCES public.stock_sections(id) ON DELETE SET NULL,
  nombre text NOT NULL,
  descripcion text,
  etiqueta_imagen_url text,
  alergenos text[] NOT NULL DEFAULT '{}'::text[],
  trazas text[] NOT NULL DEFAULT '{}'::text[],
  justificacion text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_stock_ingredients_restaurante_nombre_unique
  ON public.stock_ingredients (restaurante_id, lower(nombre));

CREATE INDEX IF NOT EXISTS idx_stock_ingredients_section_id
  ON public.stock_ingredients (section_id);

COMMIT;
