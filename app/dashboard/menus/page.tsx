"use client";

import React, { useEffect, useState } from "react";
import { createClient } from "@supabase/supabase-js";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Plus,
  BookOpen,
  FileText,
  Settings,
  Trash2,
  CheckCircle2,
} from "lucide-react";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

type Menu = {
  id: string;
  restaurante_id: string;
  nombre: string;
  descripcion: string | null;
  activo: boolean | null;
  created_at: string;
};

export default function MenusPage() {
  const router = useRouter();
  const [nombreMenu, setNombreMenu] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [menusGuardados, setMenusGuardados] = useState<Menu[]>([]);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [settingsMenu, setSettingsMenu] = useState<Menu | null>(null);

  const canContinue = nombreMenu.trim().length > 0;

  const getRestaurantId = async () => {
    const fromStorage = localStorage.getItem("restaurantId");
    if (fromStorage) return fromStorage;

    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user?.id) return null;

    localStorage.setItem("restaurantId", data.user.id);
    return data.user.id;
  };

  useEffect(() => {
    let active = true;

    const loadInitialMenus = async () => {
      const restauranteId = await getRestaurantId();
      if (!active) return;

      if (!restauranteId) {
        setMenusGuardados([]);
        return;
      }

      const { data, error } = await supabase
        .from("menus")
        .select("id, restaurante_id, nombre, descripcion, activo, created_at")
        .eq("restaurante_id", restauranteId)
        .order("created_at", { ascending: false });

      if (!active) return;

      if (error) {
        setError(error.message);
        return;
      }

      setMenusGuardados(data ?? []);
    };

    void loadInitialMenus();

    return () => {
      active = false;
    };
  }, []);

  const handleCrearMenu = async () => {
    if (!nombreMenu.trim()) return;

    setGuardando(true);
    setError(null);

    const restauranteId = await getRestaurantId();
    if (!restauranteId) {
      setGuardando(false);
      router.push("/registro");
      return;
    }

    const { data, error } = await supabase
      .from("menus")
      .insert({
        restaurante_id: restauranteId,
        nombre: nombreMenu.trim(),
        descripcion: descripcion.trim() || null,
        activo: false,
      })
      .select("id")
      .single();

    if (error) {
      setError(error.message);
      setGuardando(false);
      return;
    }

    setGuardando(false);
    setShowCreateModal(false);
    setNombreMenu("");
    setDescripcion("");
    router.push(`/dashboard/menus/nuevo?menuId=${data.id}`);
  };

  const handleActivarMenu = async (menu: Menu) => {
    setGuardando(true);
    setError(null);

    const restauranteId = menu.restaurante_id || (await getRestaurantId());
    if (!restauranteId) {
      setGuardando(false);
      router.push("/registro");
      return;
    }

    const { error: desactivarError } = await supabase
      .from("menus")
      .update({ activo: false })
      .eq("restaurante_id", restauranteId);

    if (desactivarError) {
      setError(desactivarError.message);
      setGuardando(false);
      return;
    }

    const { data: activatedRows, error: activarError } = await supabase
      .from("menus")
      .update({ activo: true })
      .eq("id", menu.id)
      .eq("restaurante_id", restauranteId)
      .select("id, activo");

    if (activarError || !activatedRows || activatedRows.length === 0) {
      setError(activarError?.message ?? "No se pudo activar el menú.");
      setGuardando(false);
      return;
    }

    setMenusGuardados((prev) =>
      prev.map((item) => ({
        ...item,
        activo: item.id === menu.id,
      }))
    );
    setSettingsMenu((prev) => (prev ? { ...prev, activo: true } : prev));
    setGuardando(false);
  };

  const handleEliminarMenu = async (menuId: string) => {
    setGuardando(true);
    setError(null);

    const { error: relError } = await supabase
      .from("menu_platos")
      .delete()
      .eq("menu_id", menuId);

    if (relError) {
      setError(relError.message);
      setGuardando(false);
      return;
    }

    const { data: deletedRows, error: deleteError } = await supabase
      .from("menus")
      .delete()
      .eq("id", menuId)
      .select("id");

    if (deleteError || !deletedRows || deletedRows.length === 0) {
      setError(deleteError?.message ?? "No se pudo eliminar el menú.");
      setGuardando(false);
      return;
    }

    setMenusGuardados((prev) => prev.filter((menu) => menu.id !== menuId));
    setSettingsMenu(null);
    setGuardando(false);
  };

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-6xl mx-auto">
        <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-4xl font-black text-gray-900">Menús</h1>
            <p className="text-gray-500 font-medium">
              Crea menús, elige el activo y administra su configuración.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                setError(null);
                setShowCreateModal(true);
              }}
              className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700"
            >
              <Plus className="h-4 w-4" />
              Crear nuevo menú
            </button>
            <button
              type="button"
              onClick={() => router.push("/dashboard")}
              className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm font-semibold text-gray-700 shadow-sm transition-all hover:-translate-y-0.5 hover:bg-gray-100 hover:shadow-md"
            >
              <ArrowLeft className="h-4 w-4" />
              Volver al Panel
            </button>
          </div>
        </div>

        {error && (
          <p className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700">
            {error}
          </p>
        )}

        <div>
          <h2 className="text-2xl font-black text-gray-900 mb-6">Tus Menús Guardados</h2>

          {menusGuardados.length === 0 ? (
            <div className="bg-white border-2 border-dashed border-gray-200 rounded-3xl p-12 text-center">
              <div className="bg-blue-50 w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <BookOpen className="w-8 h-8 text-blue-400" />
              </div>
              <h3 className="text-lg font-bold text-gray-800">Aún no tienes menús</h3>
              <p className="text-gray-500 text-sm mt-1 max-w-xs mx-auto">
                Usa el botón Crear nuevo menú para empezar.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4">
              {menusGuardados.map((menu) => (
                <div
                  key={menu.id}
                  className="group rounded-2xl border border-gray-100 bg-white p-5 shadow-sm transition-all duration-300 hover:-translate-y-0.5 hover:shadow-lg"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3">
                      <div className="rounded-xl bg-blue-50 p-3">
                        <FileText className="h-5 w-5 text-blue-600" />
                      </div>
                      <div>
                        <h3 className="text-base font-bold text-gray-900">{menu.nombre}</h3>
                        <p className="mt-1 text-sm text-gray-500">
                          {menu.descripcion?.trim() ? menu.descripcion : "Sin descripción"}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span
                        className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                          menu.activo
                            ? "bg-green-100 text-green-700"
                            : "bg-gray-100 text-gray-600"
                        }`}
                      >
                        {menu.activo ? "Activo" : "Inactivo"}
                      </span>
                      <Link
                        href={`/dashboard/menus/nuevo?menuId=${menu.id}`}
                        className="rounded-lg bg-blue-600 px-2.5 py-1 text-xs font-semibold text-white transition hover:bg-blue-700"
                      >
                        Gestionar
                      </Link>
                      <button
                        type="button"
                        onClick={() => setSettingsMenu(menu)}
                        className="rounded-lg border border-gray-200 bg-white px-2.5 py-1 text-xs font-semibold text-gray-700 transition hover:bg-gray-100 inline-flex items-center gap-1"
                      >
                        <Settings className="h-3.5 w-3.5" />
                        Ajustes
                      </button>
                    </div>
                  </div>
                  <p className="mt-3 text-xs text-gray-400">
                    Creado: {new Date(menu.created_at).toLocaleDateString()}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-2xl border border-gray-100 bg-white p-6 shadow-xl">
            <h3 className="text-lg font-bold text-gray-900">Crear Nuevo Menú</h3>
            <p className="mt-1 text-sm text-gray-500">
              Define nombre y descripción para comenzar.
            </p>

            <div className="mt-4 space-y-3">
              <div>
                <label className="mb-1 block text-xs font-bold uppercase text-gray-600">
                  Nombre del menú
                </label>
                <input
                  type="text"
                  value={nombreMenu}
                  onChange={(e) => setNombreMenu(e.target.value)}
                  className="w-full rounded-xl border border-gray-200 bg-white px-3 py-3 text-sm text-gray-900 placeholder:text-gray-400 outline-none shadow-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                  placeholder="Ej: Menú Fin de Semana"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-bold uppercase text-gray-600">
                  Descripción
                </label>
                <textarea
                  value={descripcion}
                  onChange={(e) => setDescripcion(e.target.value)}
                  className="h-24 w-full resize-none rounded-xl border border-gray-200 bg-white px-3 py-3 text-sm text-gray-900 placeholder:text-gray-400 outline-none shadow-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                  placeholder="Ej: Selección de platos de temporada"
                />
              </div>
            </div>

            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowCreateModal(false)}
                className="rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-100"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleCrearMenu}
                disabled={!canContinue || guardando}
                className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-gray-300"
              >
                {guardando ? "Creando..." : "Crear y continuar"}
              </button>
            </div>
          </div>
        </div>
      )}

      {settingsMenu && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-2xl border border-gray-100 bg-white p-6 shadow-xl">
            <h3 className="text-lg font-bold text-gray-900">Ajustes de Menú</h3>
            <p className="mt-1 text-sm text-gray-500">{settingsMenu.nombre}</p>

            <div className="mt-5 rounded-xl border border-gray-100 bg-gray-50 p-4">
              <p className="text-sm font-semibold text-gray-800">Menú activo</p>
              <p className="mt-1 text-xs text-gray-500">
                Solo un menú puede estar activo al mismo tiempo.
              </p>
              <button
                type="button"
                onClick={() => void handleActivarMenu(settingsMenu)}
                disabled={guardando || Boolean(settingsMenu.activo)}
                className="mt-3 inline-flex items-center gap-2 rounded-xl bg-green-600 px-3 py-2 text-sm font-semibold text-white hover:bg-green-700 disabled:cursor-not-allowed disabled:bg-gray-300"
              >
                <CheckCircle2 className="h-4 w-4" />
                {settingsMenu.activo ? "Este menú ya está activo" : "Activar este menú"}
              </button>
            </div>

            <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-4">
              <p className="text-sm font-semibold text-red-700">Eliminar menú</p>
              <p className="mt-1 text-xs text-red-600">
                Se eliminarán sus vínculos con platos. Esta acción no se puede deshacer.
              </p>
              <button
                type="button"
                onClick={() => void handleEliminarMenu(settingsMenu.id)}
                disabled={guardando}
                className="mt-3 inline-flex items-center gap-2 rounded-xl bg-red-600 px-3 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:bg-gray-300"
              >
                <Trash2 className="h-4 w-4" />
                Eliminar menú
              </button>
            </div>

            <div className="mt-5 flex justify-end">
              <button
                type="button"
                onClick={() => setSettingsMenu(null)}
                className="rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-100"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
