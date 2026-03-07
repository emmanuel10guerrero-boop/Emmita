"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { createClient } from "@supabase/supabase-js";
import { ArrowLeft, Download, FileSpreadsheet, LineChart } from "lucide-react";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

type PlatoRow = {
  id: string;
  nombre?: string | null;
  alergenos?: string[] | null;
  trazas?: string[] | null;
  notas_internas?: string | null;
  justificacion?: string | null;
  created_at: string;
};

type OrdenRow = {
  id: string;
  estado: string | null;
  total: number | null;
  created_at: string;
  orden_items?: {
    id: string;
    cantidad: number | null;
    item: {
      id: string;
      nombre: string | null;
    }[] | null;
  }[];
};

const EU_ALLERGENS = [
  { key: "gluten", label: "Cereales con gluten", aliases: ["gluten", "trigo", "cebada", "centeno", "avena", "espelta"] },
  { key: "crustaceos", label: "Crustáceos", aliases: ["crustaceos", "crustaceo", "mariscos", "gambas", "langostinos"] },
  { key: "huevo", label: "Huevos", aliases: ["huevo", "huevos"] },
  { key: "pescado", label: "Pescado", aliases: ["pescado", "pez"] },
  { key: "cacahuetes", label: "Cacahuetes", aliases: ["cacahuate", "cacahuetes", "mani", "maní"] },
  { key: "soja", label: "Soja", aliases: ["soja", "soya"] },
  { key: "leche", label: "Leche", aliases: ["lacteos", "lacteo", "leche", "queso", "mantequilla"] },
  { key: "frutos_de_cascara", label: "Frutos de cáscara", aliases: ["frutos secos", "nueces", "almendra", "avellana", "pistacho", "anacardo"] },
  { key: "apio", label: "Apio", aliases: ["apio"] },
  { key: "mostaza", label: "Mostaza", aliases: ["mostaza"] },
  { key: "sesamo", label: "Sésamo", aliases: ["sesamo", "sésamo"] },
  { key: "sulfitos", label: "Sulfitos", aliases: ["sulfitos", "sulfito"] },
  { key: "altramuces", label: "Altramuces", aliases: ["altramuz", "altramuces", "lupino", "lupinos"] },
  { key: "moluscos", label: "Moluscos", aliases: ["molusco", "moluscos"] },
] as const;

function normalizeText(value: string) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

function csvEscape(value: unknown) {
  if (value == null) return "";
  const text = String(value).replace(/"/g, "\"\"");
  return `"${text}"`;
}

function buildCsv(headers: string[], rows: (string | number)[][]) {
  const lines = [headers.map(csvEscape).join(",")];
  for (const row of rows) lines.push(row.map(csvEscape).join(","));
  return lines.join("\n");
}

function triggerDownload(filename: string, content: string) {
  const blob = new Blob([content], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export default function ReportesPage() {
  const [restaurantId, setRestaurantId] = useState<string | null>(null);
  const [dateFrom, setDateFrom] = useState(() => {
    const now = new Date();
    now.setDate(now.getDate() - 30);
    return now.toISOString().slice(0, 10);
  });
  const [dateTo, setDateTo] = useState(() => new Date().toISOString().slice(0, 10));
  const [platos, setPlatos] = useState<PlatoRow[]>([]);
  const [ordenes, setOrdenes] = useState<OrdenRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const getRestaurantId = useCallback(async () => {
    const fromStorage = localStorage.getItem("restaurantId");
    if (fromStorage) return fromStorage;

    const { data, error: sessionError } = await supabase.auth.getUser();
    if (sessionError || !data.user?.id) return null;

    localStorage.setItem("restaurantId", data.user.id);
    return data.user.id;
  }, []);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);

    const id = await getRestaurantId();
    if (!id) {
      setError("No se encontró el restaurante asociado a la sesión.");
      setLoading(false);
      return;
    }
    setRestaurantId(id);

    const fromIso = `${dateFrom}T00:00:00.000Z`;
    const toIso = `${dateTo}T23:59:59.999Z`;

    const [{ data: platosData, error: platosError }, { data: ordenesData, error: ordenesError }] =
      await Promise.all([
        supabase
          .from("items")
          .select("id, nombre, alergenos, trazas, notas_internas, justificacion, created_at")
          .eq("restaurante_id", id)
          .order("created_at", { ascending: false }),
        supabase
          .from("ordenes")
          .select(`
            id,
            estado,
            total,
            created_at,
            orden_items (
              id,
              cantidad,
              item:items (
                id,
                nombre
              )
            )
          `)
          .eq("restaurante_id", id)
          .gte("created_at", fromIso)
          .lte("created_at", toIso)
          .order("created_at", { ascending: false }),
      ]);

    if (platosError || ordenesError) {
      setError(platosError?.message ?? ordenesError?.message ?? "Error cargando reportes.");
      setLoading(false);
      return;
    }

    setPlatos((platosData ?? []) as PlatoRow[]);
    setOrdenes((ordenesData ?? []) as OrdenRow[]);
    setLoading(false);
  }, [dateFrom, dateTo, getRestaurantId]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadData();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [loadData]);

  const stats = useMemo(() => {
    const totalVentas = ordenes.reduce((acc, item) => acc + (item.total ?? 0), 0);
    const ticketPromedio = ordenes.length > 0 ? totalVentas / ordenes.length : 0;
    const pendientes = ordenes.filter((o) => (o.estado ?? "").toLowerCase() === "pendiente").length;
    return { totalVentas, ticketPromedio, pendientes };
  }, [ordenes]);

  const descargarCsvFic = () => {
    if (!restaurantId) return;
    const headers = [
      "fecha_exportacion",
      "restaurante_id",
      "item_id",
      "nombre_item",
      "alergenos_declarados",
      "trazas",
      "justificacion",
      ...EU_ALLERGENS.map((a) => `fic_${a.key}`),
      "alergenos_fuera_catalogo_fic",
    ];

    const rows = platos.map((plato) => {
      const declared = (plato.alergenos ?? []).map(normalizeText);
      const unknown: string[] = [];

      const flags = EU_ALLERGENS.map((allergen) => {
        const match = declared.some((value) =>
          allergen.aliases.some((alias) => value.includes(normalizeText(alias)))
        );
        return match ? "SI" : "NO";
      });

      for (const original of plato.alergenos ?? []) {
        const n = normalizeText(original);
        const known = EU_ALLERGENS.some((a) =>
          a.aliases.some((alias) => n.includes(normalizeText(alias)))
        );
        if (!known) unknown.push(original);
      }

      return [
        new Date().toISOString(),
        restaurantId,
        plato.id,
        plato.nombre ?? "Item sin nombre",
        (plato.alergenos ?? []).join(" | "),
        (plato.trazas ?? []).join(" | "),
        plato.justificacion ?? "",
        ...flags,
        unknown.join(" | "),
      ];
    });

    triggerDownload(`reporte_fic_1169_2011_${dateFrom}_${dateTo}.csv`, buildCsv(headers, rows));
  };

  const descargarCsvVentas = () => {
    if (!restaurantId) return;
    const headers = [
      "orden_id",
      "fecha",
      "estado",
      "total",
      "cantidad_items",
      "platos",
      "restaurante_id",
    ];
    const rows = ordenes.map((orden) => {
      const itemCount = (orden.orden_items ?? []).reduce((acc, item) => acc + (item.cantidad ?? 1), 0);
      const platosOrden = (orden.orden_items ?? [])
        .map((item) => `${item.item?.[0]?.nombre ?? "Item"} x${item.cantidad ?? 1}`)
        .join(" | ");
      return [
        orden.id,
        orden.created_at,
        orden.estado ?? "sin_estado",
        orden.total ?? 0,
        itemCount,
        platosOrden,
        restaurantId,
      ];
    });

    triggerDownload(`reporte_ventas_${dateFrom}_${dateTo}.csv`, buildCsv(headers, rows));
  };

  const descargarCsvResumenDiario = () => {
    if (!restaurantId) return;
    const grouped = new Map<string, { pedidos: number; total: number }>();
    for (const orden of ordenes) {
      const day = new Date(orden.created_at).toISOString().slice(0, 10);
      const current = grouped.get(day) ?? { pedidos: 0, total: 0 };
      current.pedidos += 1;
      current.total += orden.total ?? 0;
      grouped.set(day, current);
    }

    const headers = ["fecha", "pedidos", "ventas_totales", "ticket_promedio", "restaurante_id"];
    const rows = Array.from(grouped.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([day, values]) => [
        day,
        values.pedidos,
        values.total.toFixed(2),
        values.pedidos > 0 ? (values.total / values.pedidos).toFixed(2) : "0",
        restaurantId,
      ]);

    triggerDownload(`reporte_resumen_diario_${dateFrom}_${dateTo}.csv`, buildCsv(headers, rows));
  };

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="mx-auto max-w-6xl space-y-6">
        <header className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-3xl font-black text-gray-900">Reportes</h1>
            <p className="text-sm text-gray-500">
              Exporta CSV para cumplimiento (FIC 1169/2011) y seguimiento comercial.
            </p>
          </div>
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-100"
          >
            <ArrowLeft className="h-4 w-4" />
            Volver al Panel
          </Link>
        </header>

        <section className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <label className="text-sm font-medium text-gray-700">
              Desde
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="mt-1 block w-full rounded-xl border border-gray-200 px-3 py-2 text-sm"
              />
            </label>
            <label className="text-sm font-medium text-gray-700">
              Hasta
              <input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="mt-1 block w-full rounded-xl border border-gray-200 px-3 py-2 text-sm"
              />
            </label>
            <div className="flex items-end">
              <button
                type="button"
                onClick={() => void loadData()}
                className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-black px-4 py-2 text-sm font-semibold text-white hover:bg-gray-800"
              >
                <LineChart className="h-4 w-4" />
                Actualizar métricas
              </button>
            </div>
          </div>
        </section>

        <section className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <article className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
            <p className="text-xs font-bold uppercase text-gray-500">Ventas (periodo)</p>
            <p className="mt-1 text-2xl font-black text-gray-900">${stats.totalVentas.toFixed(2)}</p>
          </article>
          <article className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
            <p className="text-xs font-bold uppercase text-gray-500">Órdenes</p>
            <p className="mt-1 text-2xl font-black text-gray-900">{ordenes.length}</p>
          </article>
          <article className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
            <p className="text-xs font-bold uppercase text-gray-500">Ticket promedio</p>
            <p className="mt-1 text-2xl font-black text-gray-900">${stats.ticketPromedio.toFixed(2)}</p>
            <p className="mt-1 text-xs text-gray-500">Pendientes: {stats.pendientes}</p>
          </article>
        </section>

        <section className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-bold text-gray-900">Exportación de archivos</h2>
          <p className="mt-1 text-sm text-gray-500">
            Estos CSV sirven como base para auditoría, trazabilidad de alérgenos y análisis de ventas.
          </p>
          <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-3">
            <button
              type="button"
              onClick={descargarCsvFic}
              disabled={loading}
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-blue-200 bg-blue-50 px-4 py-2 text-sm font-semibold text-blue-700 hover:bg-blue-100 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <FileSpreadsheet className="h-4 w-4" />
              CSV FIC 1169/2011
            </button>
            <button
              type="button"
              onClick={descargarCsvVentas}
              disabled={loading}
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-green-200 bg-green-50 px-4 py-2 text-sm font-semibold text-green-700 hover:bg-green-100 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <Download className="h-4 w-4" />
              CSV Ventas
            </button>
            <button
              type="button"
              onClick={descargarCsvResumenDiario}
              disabled={loading}
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-gray-200 bg-gray-50 px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <Download className="h-4 w-4" />
              CSV Resumen diario
            </button>
          </div>
        </section>

        <section className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
          {loading ? (
            <p className="text-sm text-gray-500">Cargando datos...</p>
          ) : error ? (
            <p className="text-sm text-red-700">{error}</p>
          ) : (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="rounded-xl border border-gray-100 bg-gray-50 p-4">
                <p className="text-xs font-bold uppercase text-gray-500">Platos registrados</p>
                <p className="mt-1 text-lg font-bold text-gray-900">{platos.length}</p>
                <p className="text-xs text-gray-500">
                  Incluye soporte de alérgenos para el reporte FIC.
                </p>
              </div>
              <div className="rounded-xl border border-gray-100 bg-gray-50 p-4">
                <p className="text-xs font-bold uppercase text-gray-500">Órdenes en periodo</p>
                <p className="mt-1 text-lg font-bold text-gray-900">{ordenes.length}</p>
                <p className="text-xs text-gray-500">
                  Rango: {dateFrom} a {dateTo}
                </p>
              </div>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

// PAGE_INFO: Reportes operativos con exportación CSV (FIC 1169/2011, ventas y resumen diario).
