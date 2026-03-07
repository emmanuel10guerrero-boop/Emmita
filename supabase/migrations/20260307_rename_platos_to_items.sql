-- Renombrar modelo de datos: platos -> items
-- Ejecutar en SQL Editor de Supabase (idealmente en staging primero).

BEGIN;

-- 1) Tablas principales
ALTER TABLE IF EXISTS public.platos RENAME TO items;
ALTER TABLE IF EXISTS public.menu_platos RENAME TO menu_items;

-- 2) Columnas de relación
DO $$
DECLARE
  r RECORD;
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'menu_items' AND column_name = 'plato_id'
  ) THEN
    ALTER TABLE public.menu_items RENAME COLUMN plato_id TO item_id;
  END IF;
END $$;

DO $$
DECLARE
  r RECORD;
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'orden_items' AND column_name = 'plato_id'
  ) THEN
    ALTER TABLE public.orden_items RENAME COLUMN plato_id TO item_id;
  END IF;
END $$;

-- 3) Recrear claves foráneas críticas (si existen tablas/columnas)
DO $$
BEGIN
  -- menu_items -> items
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'menu_items' AND column_name = 'item_id'
  ) THEN
    -- Eliminamos FK previa si existe (nombre variable)
    FOR r IN (
      SELECT conname
      FROM pg_constraint
      WHERE conrelid = 'public.menu_items'::regclass
        AND contype = 'f'
        AND pg_get_constraintdef(oid) ILIKE '%item_id%'
    ) LOOP
      EXECUTE format('ALTER TABLE public.menu_items DROP CONSTRAINT %I', r.conname);
    END LOOP;

    ALTER TABLE public.menu_items
      ADD CONSTRAINT menu_items_item_id_fkey
      FOREIGN KEY (item_id) REFERENCES public.items(id) ON DELETE CASCADE;
  END IF;

  -- menu_items -> menus
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'menu_items' AND column_name = 'menu_id'
  ) THEN
    -- Evita duplicar FK si ya existe
    IF NOT EXISTS (
      SELECT 1
      FROM pg_constraint
      WHERE conrelid = 'public.menu_items'::regclass
        AND conname = 'menu_items_menu_id_fkey'
    ) THEN
      ALTER TABLE public.menu_items
        ADD CONSTRAINT menu_items_menu_id_fkey
        FOREIGN KEY (menu_id) REFERENCES public.menus(id) ON DELETE CASCADE;
    END IF;
  END IF;

  -- orden_items -> items
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'orden_items' AND column_name = 'item_id'
  ) THEN
    FOR r IN (
      SELECT conname
      FROM pg_constraint
      WHERE conrelid = 'public.orden_items'::regclass
        AND contype = 'f'
        AND pg_get_constraintdef(oid) ILIKE '%item_id%'
    ) LOOP
      EXECUTE format('ALTER TABLE public.orden_items DROP CONSTRAINT %I', r.conname);
    END LOOP;

    ALTER TABLE public.orden_items
      ADD CONSTRAINT orden_items_item_id_fkey
      FOREIGN KEY (item_id) REFERENCES public.items(id) ON DELETE CASCADE;
  END IF;
EXCEPTION
  WHEN undefined_table THEN
    NULL;
END $$;

-- 4) Índices recomendados
CREATE INDEX IF NOT EXISTS idx_menu_items_menu_id ON public.menu_items(menu_id);
CREATE INDEX IF NOT EXISTS idx_menu_items_item_id ON public.menu_items(item_id);
CREATE INDEX IF NOT EXISTS idx_orden_items_item_id ON public.orden_items(item_id);

COMMIT;
