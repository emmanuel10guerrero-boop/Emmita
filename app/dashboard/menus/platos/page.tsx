"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@supabase/supabase-js";
import { ArrowLeft, Pencil, Plus, Trash2 } from "lucide-react";

type ItemListado = {
  id: string;
  nombre: string | null;
  activo: boolean | null;
  seccion: string | null;
  created_at: string;
};

type MenuSection = {
  id: string;
  nombre: string;
  created_at: string;
};

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

function normalizeSection(value: string | null | undefined) {
  return (value ?? "").trim().toLowerCase();
}

export default function PlatosMenuPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const menuId = searchParams.get("menuId");

  const [menuNombre, setMenuNombre] = useState("");
  const [items, setItems] = useState<ItemListado[]>([]);
  const [sections, setSections] = useState<MenuSection[]>([]);
  const [cargando, setCargando] = useState(true);
  const [eliminandoId, setEliminandoId] = useState<string | null>(null);
  const [actualizandoEstadoId, setActualizandoEstadoId] = useState<string | null>(null);
  const [mensajeError, setMensajeError] = useState<string | null>(null);

  const [showSectionModal, setShowSectionModal] = useState(false);
  const [sectionDraft, setSectionDraft] = useState("");
  const [editingSection, setEditingSection] = useState<MenuSection | null>(null);
  const [guardandoSeccion, setGuardandoSeccion] = useState(false);
  const [eliminandoSeccionId, setEliminandoSeccionId] = useState<string | null>(null);

  const getNombreItem = (item: ItemListado) => item.nombre ?? "Item sin nombre";

  const itemsSinSeccion = useMemo(
    () => items.filter((item) => normalizeSection(item.seccion) === ""),
    [items]
  );

  const loadData = useCallback(async () => {
    if (!menuId) return;
    setCargando(true);
    setMensajeError(null);

    const [{ data: menuData, error: menuError }, { data: sectionsData, error: sectionsError }] =
      await Promise.all([
        supabase.from("menus").select("nombre").eq("id", menuId).single(),
        supabase
          .from("menu_sections")
          .select("id, nombre, created_at")
          .eq("menu_id", menuId)
          .order("created_at", { ascending: true }),
      ]);

    if (menuError) {
      setMensajeError(`No se pudo cargar el menú: ${menuError.message}`);
      setCargando(false);
      return;
    }

    if (sectionsError) {
      setMensajeError(`No se pudieron cargar las secciones: ${sectionsError.message}`);
      setCargando(false);
      return;
    }

    setMenuNombre((menuData?.nombre as string | null) ?? "");
    setSections((sectionsData ?? []) as MenuSection[]);

    const { data: links, error: linksError } = await supabase
      .from("menu_items")
      .select("item_id")
      .eq("menu_id", menuId);

    if (linksError) {
      setMensajeError(`No se pudieron cargar relaciones del menú: ${linksError.message}`);
      setItems([]);
      setCargando(false);
      return;
    }

    const itemIds = (links ?? [])
      .map((row) => row.item_id as string | null)
      .filter((id): id is string => Boolean(id));

    if (itemIds.length === 0) {
      setItems([]);
      setCargando(false);
      return;
    }

    const { data: itemsData, error: itemsError } = await supabase
      .from("items")
      .select("id, nombre, activo, seccion, created_at")
      .in("id", itemIds)
      .order("created_at", { ascending: false });

    if (itemsError) {
      setMensajeError(`No se pudieron cargar items: ${itemsError.message}`);
      setItems([]);
      setCargando(false);
      return;
    }

    const normalizados = (itemsData ?? []).map((item) => ({
      id: item.id as string,
      nombre: (item.nombre as string | null | undefined) ?? null,
      activo: (item.activo as boolean | null | undefined) ?? true,
      seccion: (item.seccion as string | null | undefined) ?? null,
      created_at: item.created_at as string,
    }));

    setItems(normalizados);
    setCargando(false);
  }, [menuId]);

  useEffect(() => {
    if (!menuId) return;
    const timer = window.setTimeout(() => {
      void loadData();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [menuId, loadData]);

  const openCreateSection = () => {
    setEditingSection(null);
    setSectionDraft("");
    setShowSectionModal(true);
  };

  const openEditSection = (section: MenuSection) => {
    setEditingSection(section);
    setSectionDraft(section.nombre);
    setShowSectionModal(true);
  };

  const handleSaveSection = async () => {
    if (!menuId) return;
    const nombre = sectionDraft.trim();
    if (!nombre) return;

    setGuardandoSeccion(true);
    setMensajeError(null);

    if (!editingSection) {
      const { data, error } = await supabase
        .from("menu_sections")
        .insert({ menu_id: menuId, nombre })
        .select("id, nombre, created_at")
        .single();

      if (error || !data) {
        setMensajeError(
          `No se pudo crear la sección. Verifica que exista la tabla 'menu_sections' y sus políticas RLS. Detalle: ${error?.message ?? "sin detalle"}`
        );
        setGuardandoSeccion(false);
        return;
      }

      setSections((prev) => [...prev, data as MenuSection]);
      setShowSectionModal(false);
      setSectionDraft("");
      setGuardandoSeccion(false);
      return;
    }

    const oldName = editingSection.nombre;
    const newName = nombre;

    const { error: updateSectionError } = await supabase
      .from("menu_sections")
      .update({ nombre: newName })
      .eq("id", editingSection.id)
      .eq("menu_id", menuId);

    if (updateSectionError) {
      setMensajeError(`No se pudo editar la sección: ${updateSectionError.message}`);
      setGuardandoSeccion(false);
      return;
    }

    if (normalizeSection(oldName) !== normalizeSection(newName)) {
      const itemIds = items.map((item) => item.id);
      if (itemIds.length > 0) {
        const { error: updateItemsError } = await supabase
          .from("items")
          .update({ seccion: newName })
          .in("id", itemIds)
          .eq("seccion", oldName);

        if (updateItemsError) {
          setMensajeError(`La sección se editó pero no se pudo sincronizar en items: ${updateItemsError.message}`);
          setGuardandoSeccion(false);
          return;
        }
      }

      setItems((prev) =>
        prev.map((item) =>
          normalizeSection(item.seccion) === normalizeSection(oldName)
            ? { ...item, seccion: newName }
            : item
        )
      );
    }

    setSections((prev) =>
      prev.map((section) =>
        section.id === editingSection.id ? { ...section, nombre: newName } : section
      )
    );

    setShowSectionModal(false);
    setSectionDraft("");
    setEditingSection(null);
    setGuardandoSeccion(false);
  };

  const handleDeleteSection = async (section: MenuSection) => {
    const hasItems = items.some(
      (item) => normalizeSection(item.seccion) === normalizeSection(section.nombre)
    );

    if (hasItems) {
      setMensajeError("No se puede eliminar una sección que contiene items.");
      return;
    }

    const ok = window.confirm(
      `¿Seguro que quieres eliminar la sección \"${section.nombre}\"?`
    );
    if (!ok) return;

    setEliminandoSeccionId(section.id);
    setMensajeError(null);

    const { error } = await supabase
      .from("menu_sections")
      .delete()
      .eq("id", section.id)
      .eq("menu_id", menuId);

    if (error) {
      setMensajeError(`No se pudo eliminar la sección: ${error.message}`);
      setEliminandoSeccionId(null);
      return;
    }

    setSections((prev) => prev.filter((row) => row.id !== section.id));
    setEliminandoSeccionId(null);
  };

  const handleEliminarItem = async (itemId: string) => {
    const ok = window.confirm(
      "¿Seguro que quieres eliminar este item? Esta acción lo borra de la base de datos."
    );
    if (!ok) return;

    setEliminandoId(itemId);
    setMensajeError(null);

    const { error: relError } = await supabase
      .from("menu_items")
      .delete()
      .eq("item_id", itemId);

    if (relError) {
      setMensajeError(`No se pudo eliminar la relación del item: ${relError.message}`);
      setEliminandoId(null);
      return;
    }

    const { error: itemError } = await supabase.from("items").delete().eq("id", itemId);

    if (itemError) {
      setMensajeError(`No se pudo eliminar el item: ${itemError.message}`);
      setEliminandoId(null);
      return;
    }

    setItems((prev) => prev.filter((item) => item.id !== itemId));
    setEliminandoId(null);
  };

  const handleToggleActivo = async (item: ItemListado) => {
    const siguiente = !(item.activo ?? true);
    setActualizandoEstadoId(item.id);
    setMensajeError(null);

    const { error } = await supabase
      .from("items")
      .update({ activo: siguiente })
      .eq("id", item.id);

    if (error) {
      setMensajeError(
        `No se pudo actualizar el estado del item. Verifica que exista la columna 'activo' en la tabla items. Detalle: ${error.message}`
      );
      setActualizandoEstadoId(null);
      return;
    }

    setItems((prev) =>
      prev.map((row) => (row.id === item.id ? { ...row, activo: siguiente } : row))
    );
    setActualizandoEstadoId(null);
  };

  if (!menuId) {
    return (
      <div className="min-h-screen bg-gray-50 p-8">
        <div className="mx-auto max-w-5xl rounded-2xl border border-red-200 bg-red-50 p-6 text-red-700">
          No se encontró el menú. Vuelve a Menús e inténtalo de nuevo.
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="mx-auto max-w-6xl space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-3xl font-black text-gray-900">Items del Menú</h1>
            <p className="text-sm text-gray-500">Menú: {menuNombre || "Sin nombre"}</p>
          </div>
          <div className="flex items-center gap-2">
            <Link
              href="/dashboard/menus"
              className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-100"
            >
              <ArrowLeft className="h-4 w-4" />
              Volver
            </Link>
            <button
              type="button"
              onClick={openCreateSection}
              className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
            >
              <Plus className="h-4 w-4" />
              Añadir sección
            </button>
          </div>
        </div>

        {mensajeError && (
          <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {mensajeError}
          </p>
        )}

        <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
          {cargando ? (
            <p className="text-sm text-gray-500">Cargando items...</p>
          ) : sections.length === 0 && itemsSinSeccion.length === 0 ? (
            <p className="text-sm text-gray-500">
              Este menú todavía no tiene secciones. Usa &quot;Añadir sección&quot; para comenzar.
            </p>
          ) : (
            <div className="space-y-4">
              {sections.map((section) => {
                const itemsSeccion = items.filter(
                  (item) => normalizeSection(item.seccion) === normalizeSection(section.nombre)
                );

                return (
                  <div
                    key={section.id}
                    className="rounded-xl border border-gray-100 bg-gray-50 p-4"
                  >
                    <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <p className="text-sm font-bold text-gray-900">{section.nombre}</p>
                        <p className="text-xs text-gray-500">{itemsSeccion.length} item(s)</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => openEditSection(section)}
                          className="inline-flex items-center gap-1 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-100"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                          Editar sección
                        </button>
                        <button
                          type="button"
                          onClick={() => void handleDeleteSection(section)}
                          disabled={eliminandoSeccionId === section.id}
                          className="inline-flex items-center gap-1 rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                          {eliminandoSeccionId === section.id ? "Eliminando..." : "Eliminar sección"}
                        </button>
                        <Link
                          href={`/dashboard/menus/nuevo?menuId=${menuId}&seccion=${encodeURIComponent(section.nombre)}`}
                          className="inline-flex items-center gap-1 rounded-lg border border-blue-200 bg-blue-50 px-3 py-1.5 text-xs font-semibold text-blue-700 hover:bg-blue-100"
                        >
                          <Plus className="h-3.5 w-3.5" />
                          Añadir item
                        </Link>
                      </div>
                    </div>

                    {itemsSeccion.length === 0 ? (
                      <p className="text-xs text-gray-500">Sin items en esta sección.</p>
                    ) : (
                      <div className="space-y-2">
                        {itemsSeccion.map((item) => (
                          <div
                            key={item.id}
                            className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-gray-100 bg-white px-3 py-2"
                          >
                            <div>
                              <p className="text-sm font-semibold text-gray-900">{getNombreItem(item)}</p>
                              <p className="text-xs text-gray-500">
                                Creado: {new Date(item.created_at).toLocaleString()}
                              </p>
                            </div>
                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                onClick={() => void handleToggleActivo(item)}
                                disabled={actualizandoEstadoId === item.id}
                                className={`inline-flex items-center gap-1 rounded-lg border px-3 py-1.5 text-xs font-semibold disabled:cursor-not-allowed disabled:opacity-60 ${
                                  (item.activo ?? true)
                                    ? "border-green-200 bg-green-50 text-green-700 hover:bg-green-100"
                                    : "border-gray-200 bg-gray-100 text-gray-700 hover:bg-gray-200"
                                }`}
                              >
                                {actualizandoEstadoId === item.id
                                  ? "Actualizando..."
                                  : (item.activo ?? true)
                                    ? "Activo"
                                    : "Inactivo"}
                              </button>
                              <button
                                type="button"
                                onClick={() =>
                                  router.push(`/dashboard/menus/nuevo?menuId=${menuId}&platoId=${item.id}`)
                                }
                                className="inline-flex items-center gap-1 rounded-lg border border-blue-200 bg-blue-50 px-3 py-1.5 text-xs font-semibold text-blue-700 hover:bg-blue-100"
                              >
                                <Pencil className="h-3.5 w-3.5" />
                                Modificar
                              </button>
                              <button
                                type="button"
                                onClick={() => void handleEliminarItem(item.id)}
                                disabled={eliminandoId === item.id}
                                className="inline-flex items-center gap-1 rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-60"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                                {eliminandoId === item.id ? "Eliminando..." : "Eliminar"}
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}

              {itemsSinSeccion.length > 0 && (
                <div className="rounded-xl border border-gray-100 bg-amber-50 p-4">
                  <p className="text-sm font-bold text-amber-800">Sin sección</p>
                  <p className="mb-3 text-xs text-amber-700">
                    Estos items no tienen sección asignada.
                  </p>
                  <div className="space-y-2">
                    {itemsSinSeccion.map((item) => (
                      <div
                        key={item.id}
                        className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-amber-100 bg-white px-3 py-2"
                      >
                        <div>
                          <p className="text-sm font-semibold text-gray-900">{getNombreItem(item)}</p>
                          <p className="text-xs text-gray-500">
                            Creado: {new Date(item.created_at).toLocaleString()}
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() =>
                            router.push(`/dashboard/menus/nuevo?menuId=${menuId}&platoId=${item.id}`)
                          }
                          className="inline-flex items-center gap-1 rounded-lg border border-blue-200 bg-blue-50 px-3 py-1.5 text-xs font-semibold text-blue-700 hover:bg-blue-100"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                          Asignar sección
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {showSectionModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-2xl border border-gray-100 bg-white p-6 shadow-xl">
            <h3 className="text-lg font-bold text-gray-900">
              {editingSection ? "Editar sección" : "Crear sección"}
            </h3>
            <p className="mt-1 text-sm text-gray-500">
              Define el nombre de la sección para organizar los items del menú.
            </p>

            <div className="mt-4">
              <label className="mb-1 block text-xs font-bold uppercase text-gray-600">
                Nombre de la sección
              </label>
              <input
                type="text"
                value={sectionDraft}
                onChange={(e) => setSectionDraft(e.target.value)}
                className="w-full rounded-xl border border-gray-200 bg-white px-3 py-3 text-sm text-gray-900 placeholder:text-gray-400 outline-none shadow-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                placeholder="Ej: Bebidas"
              />
            </div>

            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  setShowSectionModal(false);
                  setEditingSection(null);
                  setSectionDraft("");
                }}
                className="rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-100"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => void handleSaveSection()}
                disabled={!sectionDraft.trim() || guardandoSeccion}
                className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {guardandoSeccion ? "Guardando..." : editingSection ? "Guardar cambios" : "Crear sección"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// PAGE_INFO: Listado de items de un menú agrupados por secciones con CRUD de sección en modal.
