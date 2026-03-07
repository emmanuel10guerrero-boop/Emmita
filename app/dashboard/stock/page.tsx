"use client";

import { type ChangeEvent, useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@supabase/supabase-js";
import { ArrowLeft, Camera, Plus, Save, Send } from "lucide-react";
import Image from "next/image";

type AnalisisIA = {
  alergenos: string[];
  trazas: string[];
  justificacion: string;
};

type StockSection = {
  id: string;
  nombre: string;
  fixed: boolean;
  created_at: string;
};

type StockIngredient = {
  id: string;
  section_id: string | null;
  nombre: string;
  descripcion: string | null;
  etiqueta_imagen_url: string | null;
  alergenos: string[];
  trazas: string[];
  justificacion: string | null;
  created_at: string;
};

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export default function StockPage() {
  const router = useRouter();

  const [restaurantId, setRestaurantId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [sections, setSections] = useState<StockSection[]>([]);
  const [ingredients, setIngredients] = useState<StockIngredient[]>([]);
  const [selectedSectionId, setSelectedSectionId] = useState<string | null>(null);

  const [showSectionModal, setShowSectionModal] = useState(false);
  const [sectionDraft, setSectionDraft] = useState("");
  const [guardandoSeccion, setGuardandoSeccion] = useState(false);

  const [showIngredientModal, setShowIngredientModal] = useState(false);
  const [guardandoIngrediente, setGuardandoIngrediente] = useState(false);
  const [analizandoIngrediente, setAnalizandoIngrediente] = useState(false);
  const [ingredienteDraft, setIngredienteDraft] = useState({
    nombre: "",
    descripcion: "",
    imagen: null as string | null,
    instruccionesIA: "",
  });
  const [analisis, setAnalisis] = useState<AnalisisIA | null>(null);

  const getRestaurantId = useCallback(async () => {
    const fromStorage = localStorage.getItem("restaurantId");
    if (fromStorage) return fromStorage;

    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user?.id) return null;

    localStorage.setItem("restaurantId", data.user.id);
    return data.user.id;
  }, []);

  const ensureDefaultSection = useCallback(async (rid: string) => {
    const findExisting = async () => {
      const { data, error } = await supabase
        .from("stock_sections")
        .select("id, nombre, fixed, created_at")
        .eq("restaurante_id", rid)
        .ilike("nombre", "Ingredientes")
        .order("created_at", { ascending: true })
        .limit(1)
        .maybeSingle();

      if (error) throw new Error(error.message);
      return data;
    };

    const existente = await findExisting();
    if (existente) {
      if (!existente.fixed) {
        await supabase.from("stock_sections").update({ fixed: true }).eq("id", existente.id);
      }
      return existente.id as string;
    }

    const { data: creada, error: createError } = await supabase
      .from("stock_sections")
      .insert({
        restaurante_id: rid,
        nombre: "Ingredientes",
        fixed: true,
      })
      .select("id")
      .single();

    if (createError) {
      if ((createError as { code?: string }).code === "23505") {
        const existenteDespues = await findExisting();
        if (existenteDespues) return existenteDespues.id as string;
      }
      throw new Error(createError.message);
    }

    if (!creada) throw new Error("No se pudo crear la sección Ingredientes");

    return creada.id as string;
  }, []);

  const loadData = useCallback(async () => {
    const rid = await getRestaurantId();
    if (!rid) {
      router.push("/registro");
      return;
    }

    setRestaurantId(rid);
    setLoading(true);
    setError(null);

    try {
      const defaultSectionId = await ensureDefaultSection(rid);

      const [{ data: sectionsData, error: sectionsError }, { data: ingredientsData, error: ingredientsError }] =
        await Promise.all([
          supabase
            .from("stock_sections")
            .select("id, nombre, fixed, created_at")
            .eq("restaurante_id", rid)
            .order("created_at", { ascending: true }),
          supabase
            .from("stock_ingredients")
            .select("id, section_id, nombre, descripcion, etiqueta_imagen_url, alergenos, trazas, justificacion, created_at")
            .eq("restaurante_id", rid)
            .order("created_at", { ascending: false }),
        ]);

      if (sectionsError) throw new Error(sectionsError.message);
      if (ingredientsError) throw new Error(ingredientsError.message);

      const normalizedSections = (sectionsData ?? []) as StockSection[];
      const normalizedIngredients = ((ingredientsData ?? []) as any[]).map((row) => ({
        ...row,
        alergenos: Array.isArray(row.alergenos) ? row.alergenos : [],
        trazas: Array.isArray(row.trazas) ? row.trazas : [],
      })) as StockIngredient[];

      setSections(normalizedSections);
      setIngredients(normalizedIngredients);
      setSelectedSectionId((prev) =>
        prev && normalizedSections.some((s) => s.id === prev) ? prev : defaultSectionId
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : "No se pudo cargar Stock.";
      setError(message);
      setSections([]);
      setIngredients([]);
    } finally {
      setLoading(false);
    }
  }, [ensureDefaultSection, getRestaurantId, router]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const ingredientesFiltrados = useMemo(() => {
    if (!selectedSectionId) return ingredients;
    return ingredients.filter((ingredient) => ingredient.section_id === selectedSectionId);
  }, [ingredients, selectedSectionId]);

  const handleSectionSave = async () => {
    if (!restaurantId) return;
    const nombre = sectionDraft.trim();
    if (!nombre) return;

    const duplicated = sections.some((s) => s.nombre.trim().toLowerCase() === nombre.toLowerCase());
    if (duplicated) {
      setError("Ya existe una sección con ese nombre.");
      return;
    }

    setGuardandoSeccion(true);
    setError(null);

    const { data, error } = await supabase
      .from("stock_sections")
      .insert({
        restaurante_id: restaurantId,
        nombre,
        fixed: false,
      })
      .select("id, nombre, fixed, created_at")
      .single();

    if (error || !data) {
      if (error && (error as { code?: string }).code === "23505") {
        setError("Esa sección ya existe.");
      } else {
        setError(error?.message ?? "No se pudo crear la sección.");
      }
      setGuardandoSeccion(false);
      return;
    }

    setSections((prev) => [...prev, data as StockSection]);
    setSelectedSectionId(data.id as string);
    setShowSectionModal(false);
    setSectionDraft("");
    setGuardandoSeccion(false);
  };

  const handleIngredientImage = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onloadend = () => {
      setIngredienteDraft((prev) => ({ ...prev, imagen: reader.result as string }));
    };
    reader.readAsDataURL(file);
  };

  const handleAnalyzeIngredient = async () => {
    if (!ingredienteDraft.nombre.trim()) {
      setError("Añade nombre del ingrediente antes de analizar.");
      return;
    }

    if (!ingredienteDraft.descripcion.trim() && !ingredienteDraft.imagen) {
      setError("Añade descripción o imagen de etiqueta para analizar.");
      return;
    }

    setAnalizandoIngrediente(true);
    setError(null);

    try {
      const response = await fetch("/api/analizar-plato", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nombrePlato: ingredienteDraft.nombre.trim(),
          imagenBase64: ingredienteDraft.imagen,
          descripcionPlato: ingredienteDraft.descripcion.trim(),
          etiquetasIngredientes: [ingredienteDraft.nombre.trim()],
          instruccionesExtra: ingredienteDraft.instruccionesIA.trim(),
        }),
      });

      const payload = (await response.json()) as {
        success?: boolean;
        error?: string;
        alergenos?: string[];
        trazas?: string[];
        justificacion?: string;
      };

      if (!response.ok || !payload?.success) {
        throw new Error(payload?.error ?? "No se pudo analizar el ingrediente");
      }

      setAnalisis({
        alergenos: payload.alergenos ?? [],
        trazas: payload.trazas ?? [],
        justificacion: payload.justificacion ?? "Sin justificación",
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Error analizando ingrediente";
      setError(message);
    } finally {
      setAnalizandoIngrediente(false);
    }
  };

  const resetIngredientModal = () => {
    setIngredienteDraft({ nombre: "", descripcion: "", imagen: null, instruccionesIA: "" });
    setAnalisis(null);
  };

  const handleIngredientSave = async () => {
    if (!restaurantId) return;
    if (!ingredienteDraft.nombre.trim()) {
      setError("El nombre del ingrediente es obligatorio.");
      return;
    }

    const sectionId = selectedSectionId ?? sections.find((s) => s.nombre === "Ingredientes")?.id ?? null;

    setGuardandoIngrediente(true);
    setError(null);

    const { data, error } = await supabase
      .from("stock_ingredients")
      .insert({
        restaurante_id: restaurantId,
        section_id: sectionId,
        nombre: ingredienteDraft.nombre.trim(),
        descripcion: ingredienteDraft.descripcion.trim() || null,
        etiqueta_imagen_url: ingredienteDraft.imagen,
        alergenos: analisis?.alergenos ?? [],
        trazas: analisis?.trazas ?? [],
        justificacion: analisis?.justificacion ?? "Manual",
      })
      .select("id, section_id, nombre, descripcion, etiqueta_imagen_url, alergenos, trazas, justificacion, created_at")
      .single();

    if (error || !data) {
      setError(error?.message ?? "No se pudo guardar el ingrediente.");
      setGuardandoIngrediente(false);
      return;
    }

    setIngredients((prev) => [
      {
        ...(data as StockIngredient),
        alergenos: Array.isArray((data as any).alergenos) ? ((data as any).alergenos as string[]) : [],
        trazas: Array.isArray((data as any).trazas) ? ((data as any).trazas as string[]) : [],
      },
      ...prev,
    ]);

    setShowIngredientModal(false);
    resetIngredientModal();
    setGuardandoIngrediente(false);
  };

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="mx-auto max-w-6xl space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-black text-gray-900">Stock</h1>
            <p className="font-medium text-gray-500">
              Crea secciones e ingredientes para reutilizarlos al construir tus items.
            </p>
          </div>
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm font-semibold text-gray-700 shadow-sm transition-all hover:-translate-y-0.5 hover:bg-gray-100"
          >
            <ArrowLeft className="h-4 w-4" />
            Volver al Panel
          </Link>
        </div>

        {error && (
          <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700">{error}</p>
        )}

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-bold text-gray-900">Secciones</h2>
              <button
                type="button"
                onClick={() => setShowSectionModal(true)}
                className="inline-flex items-center gap-1 rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-100"
              >
                <Plus className="h-3.5 w-3.5" />
                Crear
              </button>
            </div>

            {loading ? (
              <p className="text-sm text-gray-500">Cargando...</p>
            ) : sections.length === 0 ? (
              <p className="text-sm text-gray-500">Sin secciones.</p>
            ) : (
              <div className="space-y-2">
                {sections.map((section) => (
                  <button
                    key={section.id}
                    type="button"
                    onClick={() => setSelectedSectionId(section.id)}
                    className={`w-full rounded-xl border px-3 py-2 text-left transition ${
                      selectedSectionId === section.id
                        ? "border-blue-200 bg-blue-50"
                        : "border-gray-100 bg-gray-50 hover:bg-gray-100"
                    }`}
                  >
                    <p className="text-sm font-semibold text-gray-800">{section.nombre}</p>
                    {section.fixed && (
                      <p className="mt-0.5 text-[11px] font-semibold uppercase tracking-wide text-gray-500">
                        Fija
                      </p>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="lg:col-span-2 rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-bold text-gray-900">Ingredientes</h2>
                <p className="text-sm text-gray-500">
                  {ingredientesFiltrados.length} ingrediente(s) en esta sección
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowIngredientModal(true)}
                className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
              >
                <Plus className="h-4 w-4" />
                Nuevo ingrediente
              </button>
            </div>

            {loading ? (
              <p className="text-sm text-gray-500">Cargando...</p>
            ) : ingredientesFiltrados.length === 0 ? (
              <p className="rounded-xl border border-dashed border-gray-200 bg-gray-50 px-4 py-8 text-center text-sm text-gray-500">
                Todavía no hay ingredientes en esta sección.
              </p>
            ) : (
              <div className="grid gap-3">
                {ingredientesFiltrados.map((ingredient) => (
                  <div key={ingredient.id} className="rounded-xl border border-gray-100 bg-gray-50 p-4">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div>
                        <p className="text-sm font-bold text-gray-900">{ingredient.nombre}</p>
                        <p className="mt-1 text-xs text-gray-500">
                          {new Date(ingredient.created_at).toLocaleString(undefined, {
                            year: "numeric",
                            month: "2-digit",
                            day: "2-digit",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </p>
                      </div>
                      {ingredient.etiqueta_imagen_url && (
                        <Image
                          src={ingredient.etiqueta_imagen_url}
                          alt={`Etiqueta de ${ingredient.nombre}`}
                          width={80}
                          height={80}
                          className="h-16 w-16 rounded-lg object-cover"
                        />
                      )}
                    </div>

                    {ingredient.descripcion && (
                      <p className="mt-2 text-sm text-gray-700">{ingredient.descripcion}</p>
                    )}

                    <div className="mt-3 grid gap-2 md:grid-cols-2">
                      <div className="rounded-lg bg-red-50 p-2.5">
                        <p className="text-xs font-bold uppercase tracking-wide text-red-700">Alergenos</p>
                        <p className="mt-1 text-xs text-red-900">
                          {ingredient.alergenos.length > 0
                            ? ingredient.alergenos.join(", ")
                            : "Sin alergenos registrados"}
                        </p>
                      </div>
                      <div className="rounded-lg bg-amber-50 p-2.5">
                        <p className="text-xs font-bold uppercase tracking-wide text-amber-700">Trazas</p>
                        <p className="mt-1 text-xs text-amber-900">
                          {ingredient.trazas.length > 0
                            ? ingredient.trazas.join(", ")
                            : "Sin trazas registradas"}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {showSectionModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-2xl border border-gray-100 bg-white p-6 shadow-xl">
            <h3 className="text-lg font-bold text-gray-900">Crear sección de Stock</h3>
            <p className="mt-1 text-sm text-gray-500">
              La sección fija "Ingredientes" siempre se conserva.
            </p>

            <div className="mt-4">
              <label className="mb-1 block text-xs font-bold uppercase text-gray-600">Nombre</label>
              <input
                type="text"
                value={sectionDraft}
                onChange={(e) => setSectionDraft(e.target.value)}
                className="w-full rounded-xl border border-gray-200 bg-white px-3 py-3 text-sm text-gray-900 placeholder:text-gray-400 outline-none shadow-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                placeholder="Ej: Lácteos"
              />
            </div>

            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  setShowSectionModal(false);
                  setSectionDraft("");
                }}
                className="rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-100"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleSectionSave}
                disabled={!sectionDraft.trim() || guardandoSeccion}
                className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-gray-300"
              >
                {guardandoSeccion ? "Guardando..." : "Crear sección"}
              </button>
            </div>
          </div>
        </div>
      )}

      {showIngredientModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-2xl rounded-2xl border border-gray-100 bg-white p-6 shadow-xl">
            <h3 className="text-lg font-bold text-gray-900">Nuevo ingrediente</h3>
            <p className="mt-1 text-sm text-gray-500">
              Guárdalo en Stock para reutilizarlo al crear items.
            </p>

            <div className="mt-4 grid gap-4">
              <div>
                <label className="mb-1 block text-xs font-bold uppercase text-gray-600">
                  Nombre del ingrediente
                </label>
                <input
                  type="text"
                  value={ingredienteDraft.nombre}
                  onChange={(e) => setIngredienteDraft((prev) => ({ ...prev, nombre: e.target.value }))}
                  className="w-full rounded-xl border border-gray-200 bg-white px-3 py-3 text-sm text-gray-900 placeholder:text-gray-400 outline-none shadow-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                  placeholder="Ej: Queso parmesano"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-bold uppercase text-gray-600">Descripción</label>
                <textarea
                  value={ingredienteDraft.descripcion}
                  onChange={(e) =>
                    setIngredienteDraft((prev) => ({ ...prev, descripcion: e.target.value }))
                  }
                  className="h-24 w-full resize-none rounded-xl border border-gray-200 bg-white px-3 py-3 text-sm text-gray-900 placeholder:text-gray-400 outline-none shadow-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                  placeholder="Texto de etiqueta o detalle útil"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-bold uppercase text-gray-600">
                  Foto de etiqueta (opcional)
                </label>
                <div className="relative flex min-h-36 items-center justify-center rounded-2xl border-2 border-dashed border-gray-200 p-4 transition hover:border-blue-300 hover:bg-blue-50/40">
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleIngredientImage}
                    className="absolute inset-0 cursor-pointer opacity-0"
                  />
                  {ingredienteDraft.imagen ? (
                    <Image
                      src={ingredienteDraft.imagen}
                      alt="Vista previa de etiqueta"
                      width={480}
                      height={280}
                      className="max-h-52 w-auto rounded-xl object-cover"
                    />
                  ) : (
                    <div className="text-center">
                      <Camera className="mx-auto mb-2 h-9 w-9 text-gray-300" />
                      <p className="text-sm font-medium text-gray-500">Subir foto de etiqueta</p>
                    </div>
                  )}
                </div>
              </div>

              <div>
                <label className="mb-1 block text-xs font-bold uppercase text-blue-600">
                  Instrucciones para IA
                </label>
                <textarea
                  value={ingredienteDraft.instruccionesIA}
                  onChange={(e) =>
                    setIngredienteDraft((prev) => ({ ...prev, instruccionesIA: e.target.value }))
                  }
                  className="h-20 w-full resize-none rounded-xl border border-blue-200 bg-blue-50 px-3 py-3 text-sm text-blue-900 placeholder:text-blue-400 outline-none shadow-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                  placeholder="Ej: enfócate en alérgenos ocultos de conservantes"
                />
              </div>
            </div>

            <div className="mt-5 flex flex-wrap gap-3">
              <button
                type="button"
                onClick={handleAnalyzeIngredient}
                disabled={analizandoIngrediente}
                className="inline-flex items-center gap-2 rounded-xl bg-black px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-gray-800 disabled:cursor-not-allowed disabled:bg-gray-300"
              >
                <Send className="h-4 w-4" />
                {analizandoIngrediente ? "Analizando..." : "Analizar con IA"}
              </button>

              <button
                type="button"
                onClick={handleIngredientSave}
                disabled={!ingredienteDraft.nombre.trim() || guardandoIngrediente}
                className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-gray-300"
              >
                <Save className="h-4 w-4" />
                {guardandoIngrediente ? "Guardando..." : "Guardar ingrediente"}
              </button>
            </div>

            {analisis && (
              <div className="mt-4 rounded-2xl border border-gray-100 bg-gray-50 p-4">
                <h4 className="font-bold text-gray-900">Resultado IA</h4>
                <div className="mt-3 grid gap-2 md:grid-cols-2">
                  <div className="rounded-xl bg-red-50 p-3">
                    <p className="text-xs font-bold uppercase tracking-wide text-red-700">Alergenos</p>
                    <p className="mt-1 text-sm text-red-900">
                      {analisis.alergenos.length > 0
                        ? analisis.alergenos.join(", ")
                        : "Ninguno detectado"}
                    </p>
                  </div>
                  <div className="rounded-xl bg-amber-50 p-3">
                    <p className="text-xs font-bold uppercase tracking-wide text-amber-700">Trazas</p>
                    <p className="mt-1 text-sm text-amber-900">
                      {analisis.trazas.length > 0 ? analisis.trazas.join(", ") : "Sin trazas"}
                    </p>
                  </div>
                </div>
              </div>
            )}

            <div className="mt-5 flex justify-end">
              <button
                type="button"
                onClick={() => {
                  setShowIngredientModal(false);
                  resetIngredientModal();
                }}
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

// PAGE_INFO: Gestión de stock con secciones y base de ingredientes reutilizable.
