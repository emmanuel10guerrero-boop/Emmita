"use client";

import React, { useEffect, useState } from 'react';
import { createClient } from '@supabase/supabase-js';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Plus, BookOpen, FileText, LayoutList } from 'lucide-react';

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
  const canContinue = nombreMenu.trim().length > 0;

  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const getRestaurantId = async () => {
    const fromStorage = localStorage.getItem("restaurantId");
    if (fromStorage) return fromStorage;

    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user?.id) return null;

    localStorage.setItem("restaurantId", data.user.id);
    return data.user.id;
  };

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

  router.push(`/dashboard/menus/nuevo?menuId=${data.id}`);
};

  useEffect(() => {
    const loadMenus = async () => {
      const { data, error } = await supabase
        .from("menus")
        .select("id, restaurante_id, nombre, descripcion, activo, created_at")
        .order("created_at", { ascending: false });

      if (error) {
        console.error("Error loading menus:", error.message);
        return;
      }

      setMenusGuardados(data ?? []);
    };

    void loadMenus();
  }, []);

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-6xl mx-auto">
        <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-4xl font-black text-gray-900">Menús</h1>
            <p className="text-gray-500 font-medium">
              Crea nuevos menús y organiza tus platos.
            </p>
          </div>
          <button
            type="button"
            onClick={() => router.push('/dashboard')}
            className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm font-semibold text-gray-700 shadow-sm transition-all hover:-translate-y-0.5 hover:bg-gray-100 hover:shadow-md"
          >
            <ArrowLeft className="h-4 w-4" />
            Volver al Panel
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-1 space-y-6">
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
              <div className="flex items-center gap-2 mb-6">
                <LayoutList className="w-5 h-5 text-blue-600" />
                <h2 className="font-bold text-gray-800">Crear Nuevo Menú</h2>
              </div>
              
              <div className="space-y-4">
                <div>
                  <label className="mb-1 block text-xs font-bold uppercase text-gray-600">
                    Nombre del Menú
                  </label>
                  <input
                    type="text"
                    value={nombreMenu}
                    onChange={(e) => setNombreMenu(e.target.value)}
                    placeholder="Ej: Menú Fin de Semana"
                    className="w-full rounded-xl border border-gray-200 bg-white px-3 py-3 text-sm text-gray-900 placeholder:text-gray-400 outline-none shadow-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-xs font-bold uppercase text-gray-600">
                    Descripción
                  </label>
                  <textarea
                    value={descripcion}
                    onChange={(e) => setDescripcion(e.target.value)}
                    placeholder="Ej: Selección de platos de temporada..."
                    className="h-24 w-full resize-none rounded-xl border border-gray-200 bg-white px-3 py-3 text-sm text-gray-900 placeholder:text-gray-400 outline-none shadow-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                  />
                </div>

             {canContinue ? (
              <>
                  <button
                    onClick={handleCrearMenu}
                    disabled={!nombreMenu || guardando}
                    className={`w-full py-3 rounded-xl flex items-center justify-center gap-2 font-bold transition-all ${
                      nombreMenu && !guardando
                        ? 'bg-blue-600 text-white hover:bg-blue-700 shadow-lg shadow-blue-100'
                        : 'bg-gray-100 text-gray-400 cursor-not-allowed'
                    }`}
                  >
                    <Plus className="w-5 h-5" />
                    {guardando ? 'Guardando...' : 'Siguiente: Agregar Platos'}
                  </button>

                  {error && (
                    <p className="text-sm text-red-600 mt-3">{error}</p>
                  )}
                </>
              ) : (
                  <button
                    type="button"
                    disabled
                    className="w-full rounded-xl bg-gray-100 py-3 flex items-center justify-center gap-2 font-bold text-gray-400 cursor-not-allowed"
                  >
                    <Plus className="w-5 h-5" />
                    Siguiente: Agregar Platos
                  </button>
                )}
              </div>
            </div>
          </div>

          <div className="lg:col-span-2">
            <h1 className="text-2xl font-black text-gray-900 mb-6">Tus Menús Guardados</h1>

            {menusGuardados.length === 0 ? (
              <div className="bg-white border-2 border-dashed border-gray-200 rounded-3xl p-12 text-center">
                <div className="bg-blue-50 w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4">
                  <BookOpen className="w-8 h-8 text-blue-400" />
                </div>
                <h3 className="text-lg font-bold text-gray-800">Aún no tienes menús</h3>
                <p className="text-gray-500 text-sm mt-1 max-w-xs mx-auto">
                  Utiliza el formulario de la izquierda para organizar tus platos por categorías o temporadas.
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
                          <h3 className="text-base font-bold text-gray-900">
                            {menu.nombre}
                          </h3>
                          <p className="mt-1 text-sm text-gray-500">
                            {menu.descripcion?.trim()
                              ? menu.descripcion
                              : "Sin descripción"}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span
                          className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                            menu.activo
                              ? 'bg-green-100 text-green-700'
                              : 'bg-gray-100 text-gray-600'
                          }`}
                        >
                          {menu.activo ? 'Activo' : 'Inactivo'}
                        </span>
                        <Link
                          href={`/dashboard/menus/nuevo?menuId=${menu.id}`}
                          className="rounded-lg bg-blue-600 px-2.5 py-1 text-xs font-semibold text-white transition hover:bg-blue-700"
                        >
                          Gestionar
                        </Link>
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
      </div>
    </div>
  );
}
