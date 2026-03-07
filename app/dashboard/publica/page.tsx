"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@supabase/supabase-js";
import { QRCodeSVG } from "qrcode.react";
import { ArrowLeft, Copy, ExternalLink, Globe, Store } from "lucide-react";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

type MenuActivo = {
  id: string;
  nombre: string;
  descripcion: string | null;
  created_at: string;
};

export default function PublicaPage() {
  const [origin, setOrigin] = useState("");
  const [restaurantId, setRestaurantId] = useState<string | null>(null);
  const [restaurantName, setRestaurantName] = useState("Mi restaurante");
  const [menuActivo, setMenuActivo] = useState<MenuActivo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setOrigin(window.location.origin);
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  const copyUrl = async (url: string) => {
    await navigator.clipboard.writeText(url);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1400);
  };

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);

    const fromStorage = localStorage.getItem("restaurantId");
    let id = fromStorage;

    if (!id) {
      const { data, error: userError } = await supabase.auth.getUser();
      if (userError || !data.user?.id) {
        setError("No se pudo obtener el restaurante de la sesión.");
        setLoading(false);
        return;
      }
      id = data.user.id;
      localStorage.setItem("restaurantId", id);
    }

    setRestaurantId(id);

    const [{ data: restaurant, error: restaurantError }, { data: menuData, error: menuError }] =
      await Promise.all([
        supabase
          .from("restaurantes")
          .select("nombre_restaurante")
          .eq("id", id)
          .maybeSingle(),
        supabase
          .from("menus")
          .select("id, nombre, descripcion, created_at")
          .eq("restaurante_id", id)
          .eq("activo", true)
          .order("created_at", { ascending: false }),
      ]);

    if (restaurantError || menuError) {
      setError(restaurantError?.message ?? menuError?.message ?? "No se pudo cargar la página pública.");
      setLoading(false);
      return;
    }

    const nombre = (restaurant?.nombre_restaurante as string | null) ?? "Mi restaurante";
    setRestaurantName(nombre);
    const activo = (menuData ?? [])[0] as MenuActivo | undefined;
    setMenuActivo(activo ?? null);
    setLoading(false);
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadData();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [loadData]);

  const publicUrl = restaurantId ? `${origin}/publica?rid=${restaurantId}` : "";

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="mx-auto max-w-6xl space-y-6">
        <header className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-3xl font-black text-gray-900">Página Pública</h1>
            <p className="text-sm text-gray-500">
              Gestiona los enlaces que verá el cliente desde QR o URL directa.
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
          <div className="flex flex-wrap items-center gap-3">
            <div className="rounded-xl bg-blue-50 p-3">
              <Store className="h-6 w-6 text-blue-600" />
            </div>
            <div>
              <p className="text-sm font-semibold text-gray-900">{restaurantName}</p>
              <p className="text-xs text-gray-500">ID restaurante: {restaurantId ?? "—"}</p>
            </div>
          </div>
          <div className="mt-4 rounded-xl border border-gray-200 bg-gray-50 p-3">
            <p className="text-xs font-bold uppercase text-gray-500">URL pública del menú activo</p>
            <div className="mt-1 flex flex-wrap items-center gap-2">
              <code className="rounded bg-white px-2 py-1 text-xs text-gray-700">
                {publicUrl || `${origin || "..."} /publica?rid=...`}
              </code>
              <span className="text-xs text-gray-500">
                Este enlace abre el menú activo del día.
              </span>
            </div>
          </div>
        </section>

        <section className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-center gap-2">
            <Globe className="h-4 w-4 text-gray-600" />
            <h2 className="text-lg font-bold text-gray-900">QR de página pública</h2>
          </div>

          {loading ? (
            <p className="text-sm text-gray-500">Cargando...</p>
          ) : error ? (
            <p className="text-sm text-red-700">{error}</p>
          ) : !menuActivo ? (
            <div className="space-y-2">
              <p className="text-sm text-amber-700">
                No tienes un menú activo. Activa uno desde Menús para publicar la página.
              </p>
              <Link
                href="/dashboard/menus"
                className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-100"
              >
                Ir a Menús
              </Link>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="rounded-xl border border-gray-100 bg-gray-50 p-3">
                <p className="text-sm font-semibold text-gray-900">
                  Menú activo: {menuActivo.nombre}
                </p>
                <p className="text-xs text-gray-500">{publicUrl}</p>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <div className="rounded-lg border border-gray-200 bg-white p-2">
                  <QRCodeSVG value={publicUrl} size={120} />
                </div>
                <button
                  type="button"
                  onClick={() => void copyUrl(publicUrl)}
                  className="inline-flex items-center gap-1 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-100"
                >
                  <Copy className="h-3.5 w-3.5" />
                  {copied ? "Copiado" : "Copiar enlace"}
                </button>
                <a
                  href={publicUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 rounded-lg border border-blue-200 bg-blue-50 px-3 py-1.5 text-xs font-semibold text-blue-700 hover:bg-blue-100"
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                  Abrir página pública
                </a>
              </div>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

// PAGE_INFO: Gestión del enlace/QR único a la página pública del menú activo.
