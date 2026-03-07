"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@supabase/supabase-js";
import type { PostgrestError } from "@supabase/supabase-js";
import Link from "next/link";
import { ArrowLeft, ChevronLeft, ChevronRight, ClipboardList } from "lucide-react";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

type OrdenItem = {
  id: string;
  cantidad: number | null;
  item: {
    id: string;
    nombre: string | null;
  }[] | null;
};

type Orden = {
  id: string;
  restaurante_id: string;
  estado: string | null;
  total: number | null;
  created_at: string;
  visto: boolean | null;
  orden_items?: OrdenItem[];
};

const ESTADOS = ["pendiente", "preparando", "listo"] as const;
type Estado = (typeof ESTADOS)[number];
const ESTADO_STYLES: Record<
  Estado,
  {
    pill: string;
    badge: string;
  }
> = {
  pendiente: {
    pill: "bg-amber-50 text-amber-700",
    badge: "bg-amber-100 text-amber-700",
  },
  preparando: {
    pill: "bg-blue-50 text-blue-700",
    badge: "bg-blue-100 text-blue-700",
  },
  listo: {
    pill: "bg-green-50 text-green-700",
    badge: "bg-green-100 text-green-700",
  },
};

function formatMoney(value: number | null) {
  if (value == null) return "—";
  return `$${value}`;
}

function normalizeEstado(e: string | null): Estado | "otros" {
  const v = (e ?? "").toLowerCase();
  if (v === "pendiente" || v === "preparando" || v === "listo") return v;
  return "otros";
}

export default function OrdenesPage() {
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [ordenes, setOrdenes] = useState<Orden[]>([]);
  const [orderNumbers, setOrderNumbers] = useState<Record<string, number>>({});
  const [nextOrderNumber, setNextOrderNumber] = useState(1);
  const [numbersReady, setNumbersReady] = useState(false);

  const fetchOrdenes = async (): Promise<{
    data: Orden[];
    error: PostgrestError | null;
  }> => {
    const { data, error } = await supabase
      .from("ordenes")
      .select(`
            id,
            restaurante_id,
            estado,
            total,
            created_at,
            visto,
            orden_items (
                id,
                cantidad,
                item:items (
                id,
                nombre
                )
            )
            `)
      .order("created_at", { ascending: false })
      .limit(50);

    return { data: data ?? [], error };
  };

  const loadOrdenes = async () => {
    setLoading(true);
    setError(null);

    const { data, error } = await fetchOrdenes();

    if (error) {
      setError(error.message);
      setOrdenes([]);
      setLoading(false);
      return;
    }

    setOrdenes(data);
    setLoading(false);
  };

  useEffect(() => {
    let active = true;

    const syncOrdenes = async () => {
      const { data, error } = await fetchOrdenes();
      if (!active) return;

      if (error) {
        setError(error.message);
        setOrdenes([]);
      } else {
        setError(null);
        setOrdenes(data);
      }

      setLoading(false);
    };

    void syncOrdenes();

    const channel = supabase
      .channel("ordenes-changes")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "ordenes" },
        () => {
          void syncOrdenes();
        }
      )
      .subscribe();

    return () => {
      active = false;
      supabase.removeChannel(channel);
    };
  }, []);

  useEffect(() => {
    try {
      const rawMap = localStorage.getItem("ordenes:number-map");
      const rawNext = localStorage.getItem("ordenes:number-next");

      if (rawMap) {
        const parsed = JSON.parse(rawMap) as Record<string, number>;
        setOrderNumbers(parsed);
      }

      if (rawNext) {
        const parsedNext = Number(rawNext);
        if (!Number.isNaN(parsedNext) && parsedNext >= 1 && parsedNext <= 100) {
          setNextOrderNumber(parsedNext);
        }
      }
    } catch {
      // Ignore corrupt local data and rebuild progressively.
    } finally {
      setNumbersReady(true);
    }
  }, []);

  useEffect(() => {
    if (!numbersReady) return;
    localStorage.setItem("ordenes:number-map", JSON.stringify(orderNumbers));
    localStorage.setItem("ordenes:number-next", String(nextOrderNumber));
  }, [orderNumbers, nextOrderNumber, numbersReady]);

  useEffect(() => {
    if (!numbersReady || ordenes.length === 0) return;

    const sorted = [...ordenes].sort(
      (a, b) =>
        new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    );

    let next = nextOrderNumber;
    const additions: Record<string, number> = {};

    for (const orden of sorted) {
      if (orderNumbers[orden.id]) continue;
      additions[orden.id] = next;
      next = next === 100 ? 1 : next + 1;
    }

    if (Object.keys(additions).length === 0) return;

    setOrderNumbers((prev) => ({ ...prev, ...additions }));
    setNextOrderNumber(next);
  }, [ordenes, orderNumbers, nextOrderNumber, numbersReady]);

  const grouped = useMemo(() => {
    const map: Record<string, Orden[]> = {
      pendiente: [],
      preparando: [],
      listo: [],
      otros: [],
    };

    for (const o of ordenes) {
      const e = normalizeEstado(o.estado);
      if (e === "otros") map.otros.push(o);
      else map[e].push(o);
    }
    return map;
  }, [ordenes]);

  const moveEstado = async (ordenId: string, next: Estado) => {
    setBusyId(ordenId);
    setError(null);

    const { error } = await supabase
      .from("ordenes")
      .update({ estado: next, visto: true })
      .eq("id", ordenId);

    if (error) {
      setError(error.message);
      setBusyId(null);
      return;
    }

    await loadOrdenes();
    setBusyId(null);
  };

  const prevEstado = (e: Estado) =>
    e === "listo" ? "preparando" : e === "preparando" ? "pendiente" : null;

  const nextEstado = (e: Estado) =>
    e === "pendiente" ? "preparando" : e === "preparando" ? "listo" : null;

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <header className="max-w-6xl mx-auto mb-8">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex flex-wrap items-end gap-3">
            <h1 className="text-4xl font-black text-gray-900">Órdenes</h1>
          </div>
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm font-semibold text-gray-700 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md hover:bg-gray-100"
          >
            <ArrowLeft className="h-4 w-4" />
            Volver al panel
          </Link>
        </div>
      </header>

      <div className="max-w-6xl mx-auto">
        {loading && <p className="text-gray-500 font-medium">Cargando...</p>}

        {!loading && error && (
          <div className="rounded-xl border border-red-200 bg-red-50 p-4">
            <p className="font-bold text-red-700">Error:</p>
            <p className="text-red-700">{error}</p>
          </div>
        )}
      </div>

      {!loading && !error && (
        <div className="max-w-6xl mx-auto mt-4 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {ESTADOS.map((estado) => (
            <div
              key={estado}
              className="group bg-white border border-gray-100 rounded-2xl p-5 shadow-sm min-h-[320px] transition-all duration-300 hover:-translate-y-1 hover:shadow-xl"
            >
              <div className="flex items-center justify-between">
                <span
                  className={`inline-flex h-7 items-center rounded-full px-3 text-xs font-bold uppercase tracking-wide ${ESTADO_STYLES[estado].pill}`}
                >
                  {estado}
                </span>
                <span
                  className={`inline-flex items-center justify-center min-w-7 h-7 rounded-full text-xs font-semibold ${ESTADO_STYLES[estado].badge}`}
                >
                  {grouped[estado].length}
                </span>
              </div>

              <div className="mt-4 grid gap-3">
                {grouped[estado].length === 0 ? (
                  <p className="text-sm text-gray-500">Sin órdenes</p>
                ) : (
                  grouped[estado].map((o) => {
                    const e = normalizeEstado(o.estado);
                    const prev = e === "otros" ? null : prevEstado(e);
                    const next = e === "otros" ? null : nextEstado(e);
                    const disabled = busyId === o.id;
                    const orderNumber = orderNumbers[o.id];
                    const orderLabel = orderNumber
                      ? `Orden #${String(orderNumber).padStart(3, "0")}`
                      : "Orden #---";

                    return (
                      <div
                        key={o.id}
                        className="rounded-xl border border-gray-100 bg-gray-50/70 p-4 transition-all duration-300 hover:bg-white hover:shadow-md"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <div className="rounded-lg bg-white p-1.5 text-gray-500 shadow-sm">
                              <ClipboardList className="h-3.5 w-3.5" />
                            </div>
                            <strong className="text-sm text-gray-800">
                              {orderLabel}
                            </strong>
                            {o.visto === false && (
                              <span className="text-[11px] font-bold px-2 py-1 rounded-full bg-amber-400 text-gray-900">
                                Nueva
                              </span>
                            )}
                          </div>
                          <span className="text-sm font-semibold text-gray-800">
                            {formatMoney(o.total)}
                          </span>
                        </div>

                        <div className="mt-2 text-xs text-gray-500">
                          {new Date(o.created_at).toLocaleString(undefined, {
                            year: "numeric",
                            month: "2-digit",
                            day: "2-digit",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </div>

                        <div className="mt-3">
                          <div className="text-xs font-bold text-gray-700 mb-2">
                            Platos
                          </div>

                          {o.orden_items && o.orden_items.length > 0 ? (
                            <div className="grid gap-1.5">
                              {o.orden_items.map((item) => (
                                <div
                                  key={item.id}
                                  className="flex justify-between text-sm text-gray-700"
                                >
                                  <span>
                                    {item.item?.[0]?.nombre ?? "Item sin nombre"}
                                  </span>
                                  <span className="font-medium">
                                    x{item.cantidad ?? 1}
                                  </span>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <div className="text-xs text-gray-500">
                              Sin platos cargados
                            </div>
                          )}
                        </div>

                        <div className="mt-4 flex items-center justify-between">
                          {prev ? (
                            <button
                              onClick={() => moveEstado(o.id, prev)}
                              disabled={disabled}
                              className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-gray-300 bg-white text-gray-700 shadow-sm transition-all hover:-translate-y-0.5 hover:bg-gray-100 hover:shadow disabled:cursor-not-allowed disabled:opacity-50"
                              aria-label="Mover al estado anterior"
                            >
                              <ChevronLeft className="h-4 w-4" />
                            </button>
                          ) : (
                            <div />
                          )}

                          {next ? (
                            <button
                              onClick={() => moveEstado(o.id, next)}
                              disabled={disabled}
                              className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-green-600 text-white shadow-sm transition-all hover:-translate-y-0.5 hover:bg-green-700 hover:shadow disabled:cursor-not-allowed disabled:opacity-50"
                              aria-label="Mover al siguiente estado"
                            >
                              <ChevronRight className="h-4 w-4" />
                            </button>
                          ) : (
                            <div />
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {!loading && !error && grouped.otros.length > 0 && (
        <div className="max-w-6xl mx-auto mt-6 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          Nota: Hay {grouped.otros.length} orden(es) con estado desconocido.
        </div>
      )}
    </div>
  );
}

// PAGE_INFO: Módulo de órdenes del dashboard.
