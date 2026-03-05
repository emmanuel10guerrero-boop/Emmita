"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

type Orden = {
  id: string;
  restaurante_id: string;
  estado: string | null;
  total: number | null;
  created_at: string;
};

const ESTADOS = ["pendiente", "preparando", "listo"] as const;
type Estado = (typeof ESTADOS)[number];

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

  const loadOrdenes = async () => {
    setLoading(true);
    setError(null);

    const { data, error } = await supabase
      .from("ordenes")
      .select("id, restaurante_id, estado, total, created_at")
      .order("created_at", { ascending: false })
      .limit(50);

    if (error) {
      setError(error.message);
      setOrdenes([]);
      setLoading(false);
      return;
    }

    setOrdenes((data ?? []) as Orden[]);
    setLoading(false);
  };

  useEffect(() => {
  loadOrdenes();

  const channel = supabase
    .channel("ordenes-changes")
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "ordenes" },
      () => {
        loadOrdenes();
      }
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}, []);

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
      .update({ estado: next })
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
    <div style={{ padding: 24 }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 12 }}>
        <h1 style={{ fontSize: 24, fontWeight: 600, margin: 0 }}>Órdenes</h1>
        <span style={{ fontSize: 12, opacity: 0.7 }}>
          Vista en vivo (Pendiente → Preparando → Listo)
        </span>
      </div>

      <div style={{ marginTop: 12 }}>
        {loading && <p>Cargando...</p>}

        {!loading && error && (
          <div>
            <p style={{ fontWeight: 600 }}>Error:</p>
            <p>{error}</p>
          </div>
        )}
      </div>

      {!loading && !error && (
        <div
          style={{
            marginTop: 16,
            display: "grid",
            gridTemplateColumns: "repeat(3, 1fr)",
            gap: 16,
          }}
        >
          {ESTADOS.map((estado) => (
            <div
              key={estado}
              style={{
                border: "1px solid rgba(0,0,0,0.12)",
                borderRadius: 12,
                padding: 12,
                minHeight: 280,
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <h2
                  style={{
                    fontSize: 16,
                    margin: 0,
                    textTransform: "capitalize",
                  }}
                >
                  {estado}
                </h2>
                <span style={{ fontSize: 12, opacity: 0.7 }}>
                  {grouped[estado].length}
                </span>
              </div>

              <div style={{ marginTop: 12, display: "grid", gap: 10 }}>
                {grouped[estado].length === 0 ? (
                  <p style={{ fontSize: 13, opacity: 0.7, margin: 0 }}>
                    Sin órdenes
                  </p>
                ) : (
                  grouped[estado].map((o) => {
                    const e = normalizeEstado(o.estado);
                    const prev = e === "otros" ? null : prevEstado(e);
                    const next = e === "otros" ? null : nextEstado(e);
                    const disabled = busyId === o.id;

                    return (
                      <div
                        key={o.id}
                        style={{
                          border: "1px solid rgba(0,0,0,0.12)",
                          borderRadius: 12,
                          padding: 12,
                        }}
                      >
                        <div
                          style={{
                            display: "flex",
                            justifyContent: "space-between",
                          }}
                        >
                          <strong>Orden</strong>
                          <span>{formatMoney(o.total)}</span>
                        </div>

                        <div style={{ marginTop: 6, fontSize: 12, opacity: 0.8 }}>
                          {new Date(o.created_at).toLocaleString()}
                        </div>

                        <div style={{ marginTop: 6, fontSize: 12, opacity: 0.7 }}>
                          ID: {o.id.slice(0, 8)}…
                        </div>

                        <div style={{ marginTop: 10, display: "flex", gap: 8 }}>
                          <button
                            onClick={() => prev && moveEstado(o.id, prev)}
                            disabled={!prev || disabled}
                            style={{
                                padding: "6px 12px",
                                borderRadius: 8,
                                border: "none",
                                background: "#e5e7eb",
                                color: "#111",
                                fontSize: 13,
                                cursor: !prev || disabled ? "not-allowed" : "pointer",
                                opacity: !prev || disabled ? 0.5 : 1,
                            }}
                        >
                            ← Atrás
                          </button>

                          <button
                            onClick={() => next && moveEstado(o.id, next)}
                            disabled={!next || disabled}
                            style={{
                                padding: "6px 12px",
                                borderRadius: 8,
                                border: "none",
                                background: "#22c55e",
                                color: "white",
                                fontSize: 13,
                                fontWeight: 500,
                                cursor: !next || disabled ? "not-allowed" : "pointer",
                                opacity: !next || disabled ? 0.5 : 1,
                                marginLeft: "auto",
                            }}
                            >
                            Siguiente →
                            </button>
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
        <div style={{ marginTop: 18, fontSize: 12, opacity: 0.7 }}>
          Nota: Hay {grouped.otros.length} orden(es) con estado desconocido.
        </div>
      )}
    </div>
  );
}