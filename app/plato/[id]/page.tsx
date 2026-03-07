"use client";

import { useEffect, useState } from "react";
import { createClient } from "@supabase/supabase-js";
import { useParams } from "next/navigation";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

type PlatoPublico = {
  id: string;
  nombre?: string | null;
  trazas?: string[] | string | null;
  alergenos?: string[] | null;
  justificacion?: string | null;
  restaurantes?: {
    nombre_restaurante?: string | null;
  } | null;
};

function formatList(value: string[] | string | null | undefined) {
  if (!value) return "Sin información";
  if (Array.isArray(value)) return value.length > 0 ? value.join(", ") : "Sin información";
  return value;
}

export default function PaginaPublicaPlato() {
  const params = useParams<{ id: string }>();
  const id = params?.id;
  const [plato, setPlato] = useState<PlatoPublico | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const nombrePlato =
    plato?.nombre ?? "Item sin nombre";

  useEffect(() => {
    if (!id) return;

    const obtenerPlato = async () => {
      setLoading(true);
      setError(null);

      const { data, error: fetchError } = await supabase
        .from("items")
        .select("*, restaurantes(nombre_restaurante)")
        .eq("id", id)
        .single();

      if (fetchError || !data) {
        setError(fetchError?.message ?? "No se encontró el plato solicitado.");
        setLoading(false);
        return;
      }

      setPlato(data as PlatoPublico);
      setLoading(false);
    };

    void obtenerPlato();
  }, [id]);

  if (loading) {
    return <div className="p-10 text-center text-gray-600">Cargando información...</div>;
  }

  if (error || !plato) {
    return <div className="p-10 text-center text-red-700">{error ?? "Plato no disponible."}</div>;
  }

  return (
    <div className="min-h-screen bg-white p-6">
      <div className="mx-auto max-w-md rounded-3xl border-2 border-green-500 p-6 shadow-xl">
        <div className="mb-6 text-center">
          <span className="rounded-full bg-green-100 px-3 py-1 text-xs font-bold uppercase text-green-700">
            Informe Seguro
          </span>
          <h1 className="mt-2 text-3xl font-black text-gray-900">{nombrePlato}</h1>
          <p className="text-sm text-gray-500">
            Restaurante: {plato.restaurantes?.nombre_restaurante ?? "No informado"}
          </p>
        </div>

        <div className="space-y-5">
          <div className="rounded-2xl border border-red-100 bg-red-50 p-4">
            <h3 className="mb-1 text-sm font-bold text-red-800">Alérgenos declarados</h3>
            <p className="text-sm text-red-900">{formatList(plato.alergenos)}</p>
          </div>
          <div className="rounded-2xl border border-amber-100 bg-amber-50 p-4">
            <h3 className="mb-1 text-sm font-bold text-amber-800">Trazas y advertencias</h3>
            <p className="text-sm text-amber-900">{formatList(plato.trazas)}</p>
          </div>
          <div className="rounded-2xl border border-blue-100 bg-blue-50 p-4">
            <h3 className="mb-1 text-sm font-bold text-blue-800">Análisis de IA</h3>
            <p className="text-sm italic text-blue-900">
              {plato.justificacion ?? "Sin justificación disponible."}
            </p>
          </div>
        </div>

        <p className="mt-8 text-center text-[10px] text-gray-400">
          Este informe ha sido generado por IA para fines informativos.
          Consulte siempre con el personal del local.
        </p>
      </div>
    </div>
  );
}

// PAGE_INFO: Vista pública principal de un plato por ruta dinámica /plato/[id].
