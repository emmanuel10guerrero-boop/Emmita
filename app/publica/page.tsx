"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

type Plato = {
  id: string;
  nombre: string | null;
  activo: boolean | null;
  seccion: string | null;
  alergenos: string[] | null;
  trazas: string[] | null;
};

type MenuActivo = {
  id: string;
  nombre: string;
  descripcion: string | null;
  created_at: string;
};

export default function PublicPage() {
  const params = useSearchParams();
  const rid = params.get("rid");

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [restaurantName, setRestaurantName] = useState("Restaurante");
  const [menuActivo, setMenuActivo] = useState<MenuActivo | null>(null);
  const [platos, setPlatos] = useState<Plato[]>([]);

  const getNombrePlato = (plato: Plato) =>
    plato.nombre ?? "Plato sin nombre";

  const hoy = useMemo(
    () =>
      new Date().toLocaleDateString("es-ES", {
        weekday: "long",
        day: "2-digit",
        month: "long",
        year: "numeric",
      }),
    []
  );

  useEffect(() => {
    if (!rid) return;

    const timer = window.setTimeout(async () => {
      setLoading(true);
      setError(null);

      const { data: restaurante, error: restError } = await supabase
        .from("restaurantes")
        .select("nombre_restaurante")
        .eq("id", rid)
        .maybeSingle();

      if (restError) {
        setError(`No se pudo cargar el restaurante: ${restError.message}`);
        setLoading(false);
        return;
      }

      setRestaurantName(
        (restaurante?.nombre_restaurante as string | null) ?? "Restaurante"
      );

      const { data: menuData, error: menuError } = await supabase
        .from("menus")
        .select("id, nombre, descripcion, created_at")
        .eq("restaurante_id", rid)
        .eq("activo", true)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (menuError) {
        setError(`No se pudo cargar el menú activo: ${menuError.message}`);
        setLoading(false);
        return;
      }

      if (!menuData) {
        setMenuActivo(null);
        setPlatos([]);
        setLoading(false);
        return;
      }

      setMenuActivo(menuData as MenuActivo);

      const { data: links, error: linksError } = await supabase
        .from("menu_items")
        .select("item_id")
        .eq("menu_id", menuData.id);

      if (linksError) {
        setError(`No se pudieron cargar los platos del menú: ${linksError.message}`);
        setLoading(false);
        return;
      }

      const platoIds = (links ?? [])
        .map((row) => row.item_id as string | null)
        .filter((id): id is string => Boolean(id));

      if (platoIds.length === 0) {
        setPlatos([]);
        setLoading(false);
        return;
      }

      const { data: platosData, error: platosError } = await supabase
        .from("items")
        .select("id, nombre, activo, seccion, alergenos, trazas")
        .in("id", platoIds)
        .eq("activo", true)
        .order("created_at", { ascending: false });

      if (platosError) {
        setError(`No se pudieron cargar los platos: ${platosError.message}`);
        setLoading(false);
        return;
      }

      setPlatos((platosData ?? []) as Plato[]);
      setLoading(false);
    }, 0);

    return () => window.clearTimeout(timer);
  }, [rid]);

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="mx-auto max-w-3xl space-y-5">
        <header className="rounded-3xl border border-gray-100 bg-white p-6 shadow-sm">
          <p className="text-xs font-bold uppercase tracking-wide text-blue-600">Menú del día</p>
          <h1 className="mt-1 text-3xl font-black text-gray-900">{restaurantName}</h1>
          <p className="mt-1 text-sm text-gray-500">{hoy}</p>
        </header>

        {!rid ? (
          <section className="rounded-2xl border border-red-200 bg-red-50 p-5 text-sm text-red-700 shadow-sm">
            Falta el identificador del restaurante en la URL.
          </section>
        ) : loading ? (
          <section className="rounded-2xl border border-gray-100 bg-white p-5 text-sm text-gray-500 shadow-sm">
            Cargando menú activo...
          </section>
        ) : error ? (
          <section className="rounded-2xl border border-red-200 bg-red-50 p-5 text-sm text-red-700 shadow-sm">
            {error}
          </section>
        ) : !menuActivo ? (
          <section className="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-800 shadow-sm">
            Este restaurante no tiene un menú activo en este momento.
          </section>
        ) : (
          <section className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
            <h2 className="text-xl font-bold text-gray-900">{menuActivo.nombre}</h2>
            {menuActivo.descripcion?.trim() && (
              <p className="mt-1 text-sm text-gray-600">{menuActivo.descripcion}</p>
            )}

            <div className="mt-4 space-y-3">
              {platos.length === 0 ? (
                <p className="text-sm text-gray-500">
                  El menú activo aún no tiene items activos para mostrar.
                </p>
              ) : (
                Object.entries(
                  platos.reduce<Record<string, Plato[]>>((acc, plato) => {
                    const key = plato.seccion?.trim() || "Sin sección";
                    if (!acc[key]) acc[key] = [];
                    acc[key].push(plato);
                    return acc;
                  }, {})
                ).map(([sectionName, sectionItems]) => (
                  <div key={sectionName} className="space-y-2">
                    <h3 className="text-sm font-bold uppercase tracking-wide text-gray-600">
                      {sectionName}
                    </h3>
                    {sectionItems.map((plato) => (
                      <article
                        key={plato.id}
                        className="rounded-xl border border-gray-100 bg-gray-50 p-4"
                      >
                        <h4 className="text-base font-bold text-gray-900">{getNombrePlato(plato)}</h4>
                        <p className="mt-1 text-xs text-red-700">
                          Alérgenos:{" "}
                          {plato.alergenos && plato.alergenos.length > 0
                            ? plato.alergenos.join(", ")
                            : "No declarados"}
                        </p>
                        <p className="mt-1 text-xs text-amber-700">
                          Trazas:{" "}
                          {plato.trazas && plato.trazas.length > 0
                            ? plato.trazas.join(", ")
                            : "No declaradas"}
                        </p>
                      </article>
                    ))}
                  </div>
                ))
              )}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}

// PAGE_INFO: Página pública para clientes con el menú activo del día.
