"use client";

import { type ChangeEvent, useCallback, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@supabase/supabase-js";
import { ArrowLeft, Camera, Plus, Save, Send } from "lucide-react";
import Link from "next/link";
import Image from "next/image";

type AnalisisIA = {
  alergenos: string[];
  trazas: string[];
  justificacion: string;
};

type MenuSection = {
  id: string;
  nombre: string;
  created_at: string;
};

type StockIngredient = {
  id: string;
  nombre: string;
  descripcion: string | null;
  etiqueta_imagen_url: string | null;
  alergenos: string[];
  trazas: string[];
  justificacion: string | null;
};
const ALERGENOS_PREDEFINIDOS = [
  "Gluten",
  "Lácteos",
  "Huevo",
  "Frutos secos",
  "Cacahuate",
  "Soja",
  "Pescado",
  "Mariscos",
  "Sésamo",
  "Mostaza",
  "Apio",
  "Sulfitos",
];

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export default function MenuBuilderPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const menuId = searchParams.get("menuId");
  const platoId = searchParams.get("platoId");
  const seccionParam = searchParams.get("seccion");
  const isEditing = Boolean(platoId);

  const [menuNombre, setMenuNombre] = useState<string>("");
  const [nombre, setNombrePlato] = useState("");
  const [descripcionPlato, setDescripcionPlato] = useState("");
  const [seccion, setSeccion] = useState("");
  const [ingredientes, setIngredientes] = useState<string[]>([]);
  const [stockIngredients, setStockIngredients] = useState<StockIngredient[]>([]);
  const [selectedStockIngredientId, setSelectedStockIngredientId] = useState("");
  const [stockIngredientesSectionId, setStockIngredientesSectionId] = useState<string | null>(null);
  const [showStockIngredientModal, setShowStockIngredientModal] = useState(false);
  const [guardandoStockIngredient, setGuardandoStockIngredient] = useState(false);
  const [analizandoStockIngredient, setAnalizandoStockIngredient] = useState(false);
  const [stockIngredientAnalisis, setStockIngredientAnalisis] = useState<AnalisisIA | null>(null);
  const [stockIngredientDraft, setStockIngredientDraft] = useState({
    nombre: "",
    descripcion: "",
    imagen: null as string | null,
    instruccionesIA: "",
  });
  const [alergenosSeleccionados, setAlergenosSeleccionados] = useState<string[]>([]);
  const [alergenoInput, setAlergenoInput] = useState("");
  const [imagen, setImagen] = useState<string | null>(null);
  const [notasInternas, setNotasInternas] = useState("");
  const [instruccionesIA, setInstruccionesIA] = useState("");

  const [cargandoAnalisis, setCargandoAnalisis] = useState(false);
  const [guardandoPlato, setGuardandoPlato] = useState(false);
  const [cargandoPlato, setCargandoPlato] = useState(false);
  const [mensajeError, setMensajeError] = useState<string | null>(null);
  const [analisis, setAnalisis] = useState<AnalisisIA | null>(null);
  const [sections, setSections] = useState<MenuSection[]>([]);
  const [showSectionModal, setShowSectionModal] = useState(false);
  const [sectionDraft, setSectionDraft] = useState("");
  const [guardandoSeccion, setGuardandoSeccion] = useState(false);

  const puedeAnalizar =
    nombre.trim().length > 0 &&
    (imagen !== null || descripcionPlato.trim().length > 0 || ingredientes.length > 0);

  const puedeGuardar = nombre.trim().length > 0;

  const agregarIngrediente = (raw: string) => {
    const ingrediente = raw.trim();
    if (!ingrediente) return;
    if (ingredientes.some((item) => item.toLowerCase() === ingrediente.toLowerCase())) {
      return;
    }
    setIngredientes((prev) => [...prev, ingrediente]);
  };

  const quitarIngrediente = (ingrediente: string) => {
    setIngredientes((prev) => prev.filter((item) => item !== ingrediente));
  };

  const agregarIngredienteDesdeStock = () => {
    if (!selectedStockIngredientId) return;
    const selected = stockIngredients.find((item) => item.id === selectedStockIngredientId);
    if (!selected) return;
    agregarIngrediente(selected.nombre);
  };

  const toggleAlergeno = (alergeno: string) => {
    setAlergenosSeleccionados((prev) =>
      prev.includes(alergeno)
        ? prev.filter((item) => item !== alergeno)
        : [...prev, alergeno]
    );
  };

  const agregarAlergenoPersonalizado = (raw: string) => {
    const alergeno = raw.trim();
    if (!alergeno) return;
    if (
      alergenosSeleccionados.some(
        (item) => item.toLowerCase() === alergeno.toLowerCase()
      )
    ) {
      return;
    }
    setAlergenosSeleccionados((prev) => [...prev, alergeno]);
    setAlergenoInput("");
  };

  const quitarAlergeno = (alergeno: string) => {
    setAlergenosSeleccionados((prev) => prev.filter((item) => item !== alergeno));
  };

  const handleImageChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onloadend = () => setImagen(reader.result as string);
    reader.readAsDataURL(file);
  };

  const getRestaurantId = useCallback(async () => {
    const fromStorage = localStorage.getItem("restaurantId");
    if (fromStorage) return fromStorage;

    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user?.id) return null;

    localStorage.setItem("restaurantId", data.user.id);
    return data.user.id;
  }, []);

  const loadMenuMetadata = useCallback(async () => {
    if (!menuId) return;

    const { data } = await supabase
      .from("menus")
      .select("nombre")
      .eq("id", menuId)
      .single();

    if (data?.nombre) setMenuNombre(data.nombre);
  }, [menuId]);

  const loadPlatoParaEditar = useCallback(async () => {
    if (!platoId) return;

    setCargandoPlato(true);
    setMensajeError(null);

    const { data, error } = await supabase
      .from("items")
      .select("*")
      .eq("id", platoId)
      .single();

    if (error || !data) {
      setMensajeError(error?.message ?? "No se pudo cargar el plato a editar.");
      setCargandoPlato(false);
      return;
    }

    setNombrePlato((data.nombre as string | null) ?? "");
    setDescripcionPlato((data.descripcion as string | null) ?? "");
    setSeccion((data.seccion as string | null) ?? seccionParam ?? "");
    setImagen((data.imagen_url as string | null) ?? null);
    setAlergenosSeleccionados(Array.isArray(data.alergenos) ? data.alergenos : []);
    setNotasInternas((data.notas_internas as string | null) ?? "");
    setAnalisis({
      alergenos: Array.isArray(data.alergenos) ? data.alergenos : [],
      trazas: Array.isArray(data.trazas) ? data.trazas : [],
      justificacion: (data.justificacion as string | null) ?? "Sin justificación",
    });
    setCargandoPlato(false);
  }, [platoId, seccionParam]);

  const loadSections = useCallback(async () => {
    if (!menuId) return;

    const { data, error } = await supabase
      .from("menu_sections")
      .select("id, nombre, created_at")
      .eq("menu_id", menuId);

    if (error) {
      setMensajeError(`No se pudieron cargar las secciones: ${error.message}`);
      setSections([]);
      return;
    }

    setSections((data ?? []) as MenuSection[]);
  }, [menuId]);

  const ensureDefaultStockSection = useCallback(async (restaurantId: string) => {
    const findExisting = async () => {
      const { data, error } = await supabase
        .from("stock_sections")
        .select("id, nombre, fixed")
        .eq("restaurante_id", restaurantId)
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
        restaurante_id: restaurantId,
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

  const loadStockIngredients = useCallback(async () => {
    const restaurantId = await getRestaurantId();
    if (!restaurantId) return;

    const defaultSectionId = await ensureDefaultStockSection(restaurantId);
    setStockIngredientesSectionId(defaultSectionId);

    const { data, error } = await supabase
      .from("stock_ingredients")
      .select("id, nombre, descripcion, etiqueta_imagen_url, alergenos, trazas, justificacion")
      .eq("restaurante_id", restaurantId)
      .eq("section_id", defaultSectionId)
      .order("nombre", { ascending: true });

    if (error) {
      setMensajeError(`No se pudieron cargar ingredientes de stock: ${error.message}`);
      setStockIngredients([]);
      return;
    }

    const normalized = ((data ?? []) as any[]).map((row) => ({
      ...row,
      alergenos: Array.isArray(row.alergenos) ? row.alergenos : [],
      trazas: Array.isArray(row.trazas) ? row.trazas : [],
    })) as StockIngredient[];

    setStockIngredients(normalized);
    setSelectedStockIngredientId((prev) =>
      prev && normalized.some((item) => item.id === prev) ? prev : normalized[0]?.id ?? ""
    );
  }, [ensureDefaultStockSection, getRestaurantId]);

  useEffect(() => {
    if (!menuId) return;
    void loadMenuMetadata();
    void loadSections();
    void loadStockIngredients();
  }, [menuId, loadMenuMetadata, loadSections, loadStockIngredients]);

  useEffect(() => {
    if (!platoId) return;
    void loadPlatoParaEditar();
  }, [platoId, loadPlatoParaEditar]);

  useEffect(() => {
    if (isEditing) return;
    setSeccion(seccionParam ?? "");
  }, [isEditing, seccionParam]);

  const analizarPlato = async () => {
    if (!menuId) {
      setMensajeError("No se encontró el menú actual.");
      return;
    }

    if (!puedeAnalizar) {
      setMensajeError(
        "Completa el nombre y agrega foto, descripción o ingredientes para analizar."
      );
      return;
    }

    setCargandoAnalisis(true);
    setMensajeError(null);

    try {
      const response = await fetch("/api/analizar-plato", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nombrePlato: nombre.trim(),
          imagenBase64: imagen,
          descripcionPlato: descripcionPlato.trim(),
          etiquetasIngredientes: ingredientes,
          instruccionesExtra: instruccionesIA.trim(),
        }),
      });

      const raw = await response.text();
      let resultado: {
        success?: boolean;
        error?: string;
        alergenos?: string[];
        trazas?: string[];
        justificacion?: string;
      } | null = null;
      try {
        resultado = raw ? JSON.parse(raw) : null;
      } catch {
        const snippet = raw.slice(0, 180).replace(/\s+/g, " ").trim();
        throw new Error(
          `El servidor no devolvió JSON válido (${response.status}). Respuesta: ${snippet || "vacía"}`
        );
      }

      if (!resultado || !response.ok || !resultado.success) {
        throw new Error(resultado?.error ?? "No se pudo analizar el plato");
      }

      setAnalisis({
        alergenos: resultado.alergenos ?? [],
        trazas: resultado.trazas ?? [],
        justificacion: resultado.justificacion ?? "Sin justificación",
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Error de conexión";
      setMensajeError(message);
    } finally {
      setCargandoAnalisis(false);
    }
  };

  const guardarPlatoEnMenu = async () => {
    if (!menuId || !puedeGuardar) return;

    const restaurantId = await getRestaurantId();
    if (!restaurantId) {
      router.push("/registro");
      return;
    }

    setGuardandoPlato(true);
    setMensajeError(null);

    const notasCompletas = [
      notasInternas.trim() ? `Notas internas: ${notasInternas.trim()}` : null,
      descripcionPlato.trim() ? `Descripcion declarada: ${descripcionPlato.trim()}` : null,
      ingredientes.length > 0 ? `Ingredientes declarados: ${ingredientes.join(", ")}` : null,
      analisis?.justificacion ? `Resumen IA: ${analisis.justificacion}` : null,
    ].filter(Boolean).join("\n");

    try {
      const platoPayload = {
        nombre: nombre.trim(),
        restaurante_id: restaurantId,
        descripcion: descripcionPlato.trim() || null,
        seccion: seccion.trim() || null,
        imagen_url: imagen,
        activo: true,
        alergenos: alergenosSeleccionados,
        trazas: analisis?.trazas ?? [],
        justificacion: analisis?.justificacion ?? "Manual",
        notas_internas: notasCompletas || null,
      };

      if (isEditing && platoId) {
        const { error: updateError } = await supabase
          .from("items")
          .update(platoPayload)
          .eq("id", platoId)
          .eq("restaurante_id", restaurantId);

        if (updateError) throw new Error(updateError.message);

        const { data: linkExistente, error: linkExistenteError } = await supabase
          .from("menu_items")
          .select("item_id")
          .eq("menu_id", menuId)
          .eq("item_id", platoId)
          .maybeSingle();

        if (linkExistenteError) throw new Error(linkExistenteError.message);

        if (!linkExistente) {
          const { error: linkError } = await supabase
            .from("menu_items")
            .insert({ menu_id: menuId, item_id: platoId });
          if (linkError) throw new Error(linkError.message);
        }

        router.push(`/dashboard/menus/platos?menuId=${menuId}`);
        return;
      }

      const { data: platosInsertados, error: platoError } = await supabase
        .from("items")
        .insert(platoPayload)
        .select("id");

      if (platoError) throw new Error(platoError.message);

      const nuevoPlato = platosInsertados?.[0];
      if (!nuevoPlato) throw new Error("No se pudo recuperar el ID del plato");

      const { error: linkError } = await supabase
        .from("menu_items")
        .insert({
          menu_id: menuId,
          item_id: nuevoPlato.id,
        });

      if (linkError) throw new Error(linkError.message);

      setNombrePlato("");
      setDescripcionPlato("");
      setSeccion(seccionParam ?? "");
      setImagen(null);
      setIngredientes([]);
      setAlergenosSeleccionados([]);
      setAlergenoInput("");
      setNotasInternas("");
      setInstruccionesIA("");
      setAnalisis(null);

    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Error al guardar el plato";
      setMensajeError(message);
    } finally {
      setGuardandoPlato(false);
    }
  };

  if (!menuId) {
    return (
      <div className="min-h-screen bg-gray-50 p-8">
        <div className="max-w-4xl mx-auto rounded-2xl border border-red-200 bg-red-50 p-6 text-red-700">
          No se encontró el menú. Vuelve a crear o seleccionar uno desde Menús.
        </div>
      </div>
    );
  }

  const handleSaveSection = async () => {
    if (!menuId) return;
    const nombreSeccion = sectionDraft.trim();
    if (!nombreSeccion) return;

    const existe = sections.some(
      (row) => row.nombre.trim().toLowerCase() === nombreSeccion.toLowerCase()
    );
    if (existe) {
      setMensajeError("Esa sección ya existe en este menú.");
      return;
    }

    setGuardandoSeccion(true);
    setMensajeError(null);

    const { data, error } = await supabase
      .from("menu_sections")
      .insert({ menu_id: menuId, nombre: nombreSeccion })
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
    setSeccion(nombreSeccion);
    setSectionDraft("");
    setShowSectionModal(false);
    setGuardandoSeccion(false);
  };

  const handleStockIngredientImage = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onloadend = () => {
      setStockIngredientDraft((prev) => ({ ...prev, imagen: reader.result as string }));
    };
    reader.readAsDataURL(file);
  };

  const handleAnalyzeStockIngredient = async () => {
    if (!stockIngredientDraft.nombre.trim()) {
      setMensajeError("Añade nombre del ingrediente antes de analizar.");
      return;
    }

    if (!stockIngredientDraft.descripcion.trim() && !stockIngredientDraft.imagen) {
      setMensajeError("Añade descripción o imagen de etiqueta para analizar.");
      return;
    }

    setAnalizandoStockIngredient(true);
    setMensajeError(null);

    try {
      const response = await fetch("/api/analizar-plato", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nombrePlato: stockIngredientDraft.nombre.trim(),
          imagenBase64: stockIngredientDraft.imagen,
          descripcionPlato: stockIngredientDraft.descripcion.trim(),
          etiquetasIngredientes: [stockIngredientDraft.nombre.trim()],
          instruccionesExtra: stockIngredientDraft.instruccionesIA.trim(),
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

      setStockIngredientAnalisis({
        alergenos: payload.alergenos ?? [],
        trazas: payload.trazas ?? [],
        justificacion: payload.justificacion ?? "Sin justificación",
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Error de conexión";
      setMensajeError(message);
    } finally {
      setAnalizandoStockIngredient(false);
    }
  };

  const resetStockIngredientModal = () => {
    setStockIngredientDraft({
      nombre: "",
      descripcion: "",
      imagen: null,
      instruccionesIA: "",
    });
    setStockIngredientAnalisis(null);
  };

  const handleSaveStockIngredient = async () => {
    const restaurantId = await getRestaurantId();
    if (!restaurantId) {
      router.push("/registro");
      return;
    }

    if (!stockIngredientDraft.nombre.trim()) {
      setMensajeError("El nombre del ingrediente es obligatorio.");
      return;
    }

    const sectionId = stockIngredientesSectionId ?? (await ensureDefaultStockSection(restaurantId));
    setStockIngredientesSectionId(sectionId);
    setGuardandoStockIngredient(true);
    setMensajeError(null);

    const { data, error } = await supabase
      .from("stock_ingredients")
      .insert({
        restaurante_id: restaurantId,
        section_id: sectionId,
        nombre: stockIngredientDraft.nombre.trim(),
        descripcion: stockIngredientDraft.descripcion.trim() || null,
        etiqueta_imagen_url: stockIngredientDraft.imagen,
        alergenos: stockIngredientAnalisis?.alergenos ?? [],
        trazas: stockIngredientAnalisis?.trazas ?? [],
        justificacion: stockIngredientAnalisis?.justificacion ?? "Manual",
      })
      .select("id, nombre, descripcion, etiqueta_imagen_url, alergenos, trazas, justificacion")
      .single();

    if (error || !data) {
      setMensajeError(error?.message ?? "No se pudo guardar el ingrediente de stock.");
      setGuardandoStockIngredient(false);
      return;
    }

    const nuevo = {
      ...(data as StockIngredient),
      alergenos: Array.isArray((data as any).alergenos) ? ((data as any).alergenos as string[]) : [],
      trazas: Array.isArray((data as any).trazas) ? ((data as any).trazas as string[]) : [],
    };

    setStockIngredients((prev) => [...prev, nuevo].sort((a, b) => a.nombre.localeCompare(b.nombre)));
    setSelectedStockIngredientId(nuevo.id);
    agregarIngrediente(nuevo.nombre);
    setShowStockIngredientModal(false);
    resetStockIngredientModal();
    setGuardandoStockIngredient(false);
  };

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-6xl mx-auto space-y-6">
        {cargandoPlato && (
          <p className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-2 text-sm text-blue-700">
            Cargando plato para editar...
          </p>
        )}
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-black text-gray-900">
              {isEditing ? "Modificar plato" : "Agregar Platos al Menú"}
            </h1>
            <p className="text-gray-500 font-medium">
              Menú: {menuNombre || "Sin nombre"}
            </p>
          </div>
          <Link
            href={`/dashboard/menus/platos?menuId=${menuId}`}
            className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm font-semibold text-gray-700 shadow-sm transition-all hover:-translate-y-0.5 hover:bg-gray-100"
          >
            <ArrowLeft className="h-4 w-4" />
            Volver al listado
          </Link>
        </div>

        <div className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
            <h2 className="mb-5 text-xl font-bold text-gray-900">
              1) Configura plato e ingredientes
            </h2>
            <p className="mb-4 text-sm text-gray-500">
              Puedes guardar el plato sin análisis IA. El análisis es opcional.
            </p>

            <div className="grid grid-cols-1 gap-5">
              <div>
                <label className="mb-1 block text-xs font-bold uppercase text-gray-600">
                  Nombre del item
                </label>
                <input
                  type="text"
                  value={nombre}
                  onChange={(e) => setNombrePlato(e.target.value)}
                  className="w-full rounded-xl border border-gray-200 bg-white px-3 py-3 text-sm text-gray-900 placeholder:text-gray-400 outline-none shadow-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                  placeholder="Ej: Tarta de queso"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-bold uppercase text-gray-600">
                  Sección
                </label>
                <div className="flex gap-2">
                  <select
                    value={seccion}
                    onChange={(e) => {
                      if (e.target.value === "__nueva__") {
                        setShowSectionModal(true);
                        return;
                      }
                      setSeccion(e.target.value);
                    }}
                    className="w-full rounded-xl border border-gray-200 bg-white px-3 py-3 text-sm text-gray-900 outline-none shadow-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                  >
                    <option value="">Sin sección</option>
                    {Array.from(
                      new Set(
                        [...sections.map((row) => row.nombre), seccionParam ?? "", seccion]
                          .map((value) => value.trim())
                          .filter(Boolean)
                      )
                    ).map((nombreSeccion) => (
                      <option key={nombreSeccion} value={nombreSeccion}>
                        {nombreSeccion}
                      </option>
                    ))}
                    <option value="__nueva__">+ Crear nueva sección</option>
                  </select>
                  <button
                    type="button"
                    onClick={() => setShowSectionModal(true)}
                    className="inline-flex shrink-0 items-center gap-1 rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm font-semibold text-gray-700 transition hover:bg-gray-100"
                  >
                    <Plus className="h-4 w-4" />
                    Nueva
                  </button>
                </div>
              </div>

              <div>
                <label className="mb-1 block text-xs font-bold uppercase text-gray-600">
                  Descripción del plato
                </label>
                <textarea
                  value={descripcionPlato}
                  onChange={(e) => setDescripcionPlato(e.target.value)}
                  className="h-24 w-full resize-none rounded-xl border border-gray-200 bg-white px-3 py-3 text-sm text-gray-900 placeholder:text-gray-400 outline-none shadow-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                  placeholder="Ej: Salsa cremosa con frutos secos y queso rallado."
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-bold uppercase text-gray-600">
                  Ingredientes / etiquetas
                </label>
                <div className="flex flex-wrap gap-2">
                  <select
                    value={selectedStockIngredientId}
                    onChange={(e) => setSelectedStockIngredientId(e.target.value)}
                    className="min-w-[220px] flex-1 rounded-xl border border-gray-200 bg-white px-3 py-3 text-sm text-gray-900 outline-none shadow-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                  >
                    <option value="">Selecciona ingrediente de stock</option>
                    {stockIngredients.map((ingredient) => (
                      <option key={ingredient.id} value={ingredient.id}>
                        {ingredient.nombre}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={agregarIngredienteDesdeStock}
                    disabled={!selectedStockIngredientId}
                    className="inline-flex items-center gap-1 rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm font-semibold text-gray-700 transition hover:bg-gray-100 disabled:cursor-not-allowed disabled:bg-gray-100 disabled:text-gray-400"
                  >
                    <Plus className="h-4 w-4" />
                    Añadir
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowStockIngredientModal(true)}
                    className="inline-flex items-center gap-1 rounded-xl bg-blue-600 px-3 py-2 text-sm font-semibold text-white transition hover:bg-blue-700"
                  >
                    <Plus className="h-4 w-4" />
                    Nuevo ingrediente
                  </button>
                </div>
                <p className="mt-2 text-xs text-gray-500">
                  Gestiona todos tus ingredientes en <Link href="/dashboard/stock" className="font-semibold text-blue-600 hover:underline">Stock</Link>.
                </p>
                <div className="mt-2 flex flex-wrap gap-2 rounded-xl border border-gray-100 bg-gray-50 p-3 min-h-12">
                  {ingredientes.length === 0 ? (
                    <p className="text-xs text-gray-500">Sin ingredientes cargados.</p>
                  ) : (
                    ingredientes.map((ingrediente) => (
                      <button
                        key={ingrediente}
                        type="button"
                        onClick={() => quitarIngrediente(ingrediente)}
                        className="inline-flex items-center gap-1 rounded-full bg-white px-3 py-1 text-xs font-medium text-gray-700 border border-gray-200 hover:bg-red-50 hover:text-red-700 hover:border-red-200"
                        title="Quitar ingrediente"
                      >
                        {ingrediente}
                        <span aria-hidden>×</span>
                      </button>
                    ))
                  )}
                </div>
              </div>

              <div>
                <label className="mb-1 block text-xs font-bold uppercase text-gray-600">
                  Alérgenos (selección manual)
                </label>
                <div className="flex flex-wrap gap-2 rounded-xl border border-gray-100 bg-gray-50 p-3">
                  {ALERGENOS_PREDEFINIDOS.map((alergeno) => {
                    const selected = alergenosSeleccionados.includes(alergeno);
                    return (
                      <button
                        key={alergeno}
                        type="button"
                        onClick={() => toggleAlergeno(alergeno)}
                        className={`rounded-full px-3 py-1 text-xs font-semibold border transition ${
                          selected
                            ? "bg-red-100 text-red-700 border-red-200"
                            : "bg-white text-gray-700 border-gray-200 hover:bg-gray-100"
                        }`}
                      >
                        {alergeno}
                      </button>
                    );
                  })}
                </div>
                <div className="mt-3">
                  <label className="mb-1 block text-xs font-bold uppercase text-gray-600">
                    Añadir alérgeno personalizado
                  </label>
                  <input
                    type="text"
                    value={alergenoInput}
                    onChange={(e) => setAlergenoInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        agregarAlergenoPersonalizado(alergenoInput);
                      }
                    }}
                    className="w-full rounded-xl border border-gray-200 bg-white px-3 py-3 text-sm text-gray-900 placeholder:text-gray-400 outline-none shadow-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                    placeholder="Ej: Lupino (presiona Enter para agregar)"
                  />
                </div>
                <div className="mt-2 flex flex-wrap gap-2 rounded-xl border border-gray-100 bg-gray-50 p-3 min-h-12">
                  {alergenosSeleccionados.length === 0 ? (
                    <p className="text-xs text-gray-500">Sin alérgenos seleccionados.</p>
                  ) : (
                    alergenosSeleccionados.map((alergeno) => (
                      <button
                        key={alergeno}
                        type="button"
                        onClick={() => quitarAlergeno(alergeno)}
                        className="inline-flex items-center gap-1 rounded-full bg-white px-3 py-1 text-xs font-medium text-gray-700 border border-gray-200 hover:bg-red-50 hover:text-red-700 hover:border-red-200"
                        title="Quitar alérgeno"
                      >
                        {alergeno}
                        <span aria-hidden>×</span>
                      </button>
                    ))
                  )}
                </div>
              </div>

              <div>
                <label className="mb-1 block text-xs font-bold uppercase text-gray-600">
                  Foto del plato (opcional, recomendada)
                </label>
                <div className="relative flex min-h-44 items-center justify-center rounded-2xl border-2 border-dashed border-gray-200 p-4 transition hover:border-blue-300 hover:bg-blue-50/40">
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleImageChange}
                    className="absolute inset-0 cursor-pointer opacity-0"
                  />
                  {imagen ? (
                    <Image
                      src={imagen}
                      alt="Vista previa del plato"
                      width={640}
                      height={360}
                      className="max-h-64 w-auto rounded-xl object-cover"
                    />
                  ) : (
                    <div className="text-center">
                      <Camera className="mx-auto mb-2 h-10 w-10 text-gray-300" />
                      <p className="text-sm font-medium text-gray-500">Subir foto del plato</p>
                    </div>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="mb-1 block text-xs font-bold uppercase text-gray-600">
                    Notas internas
                  </label>
                  <textarea
                    value={notasInternas}
                    onChange={(e) => setNotasInternas(e.target.value)}
                    className="h-24 w-full resize-none rounded-xl border border-gray-200 bg-white px-3 py-3 text-sm text-gray-900 placeholder:text-gray-400 outline-none shadow-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                    placeholder="Notas visibles solo para tu equipo"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-bold uppercase text-blue-600">
                    Instrucciones para IA
                  </label>
                  <textarea
                    value={instruccionesIA}
                    onChange={(e) => setInstruccionesIA(e.target.value)}
                    className="h-24 w-full resize-none rounded-xl border border-blue-200 bg-blue-50 px-3 py-3 text-sm text-blue-900 placeholder:text-blue-400 outline-none shadow-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                    placeholder="Ej: presta atención a lácteos ocultos en salsas"
                  />
                </div>
              </div>
            </div>

            <div className="mt-5 flex flex-wrap gap-3">
              <button
                type="button"
                onClick={analizarPlato}
                disabled={!puedeAnalizar || cargandoAnalisis}
                className="inline-flex items-center gap-2 rounded-xl bg-black px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-gray-800 disabled:cursor-not-allowed disabled:bg-gray-300"
              >
                <Send className="h-4 w-4" />
                {cargandoAnalisis ? "Analizando..." : "2) Analizar con IA (opcional)"}
              </button>

              <button
                type="button"
                onClick={guardarPlatoEnMenu}
                disabled={!puedeGuardar || guardandoPlato}
                className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-gray-300"
              >
                <Save className="h-4 w-4" />
                {guardandoPlato
                  ? "Guardando..."
                  : isEditing
                    ? "3) Guardar cambios"
                    : "3) Guardar plato en menú"}
              </button>
            </div>

            {mensajeError && (
              <p className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                {mensajeError}
              </p>
            )}

            {analisis && (
              <div className="mt-5 rounded-2xl border border-gray-100 bg-gray-50 p-5">
                <h3 className="text-lg font-bold text-gray-900">Resultado IA</h3>
                <div className="mt-3 space-y-3">
                  <div className="rounded-xl bg-red-50 p-3">
                    <p className="text-sm font-bold text-red-700">Alergenos</p>
                    <p className="text-sm text-red-900">
                      {analisis.alergenos?.length > 0
                        ? analisis.alergenos.join(", ")
                        : "Ninguno detectado"}
                    </p>
                    {analisis.alergenos?.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-2">
                        {analisis.alergenos.map((alergeno) => (
                          <button
                            key={alergeno}
                            type="button"
                            onClick={() => {
                              if (!alergenosSeleccionados.includes(alergeno)) {
                                setAlergenosSeleccionados((prev) => [...prev, alergeno]);
                              }
                            }}
                            className="rounded-full bg-white px-2.5 py-1 text-xs font-semibold text-red-700 border border-red-200 hover:bg-red-100"
                          >
                            + {alergeno}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="rounded-xl bg-amber-50 p-3">
                    <p className="text-sm font-bold text-amber-700">Trazas</p>
                    <p className="text-sm text-amber-900">
                      {analisis.trazas?.length > 0
                        ? analisis.trazas.join(", ")
                        : "Sin trazas reportadas"}
                    </p>
                  </div>
                  <div className="rounded-xl bg-white p-3">
                    <p className="text-sm font-bold text-gray-800">Justificación</p>
                    <p className="text-sm text-gray-700">{analisis.justificacion}</p>
                  </div>
                </div>
              </div>
            )}
        </div>
      </div>

      {showSectionModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-2xl border border-gray-100 bg-white p-6 shadow-xl">
            <h3 className="text-lg font-bold text-gray-900">Crear sección</h3>
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
                placeholder="Ej: Entradas"
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
                onClick={handleSaveSection}
                disabled={!sectionDraft.trim() || guardandoSeccion}
                className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-gray-300"
              >
                {guardandoSeccion ? "Guardando..." : "Crear sección"}
              </button>
            </div>
          </div>
        </div>
      )}

      {showStockIngredientModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-2xl rounded-2xl border border-gray-100 bg-white p-6 shadow-xl">
            <h3 className="text-lg font-bold text-gray-900">Nuevo ingrediente</h3>
            <p className="mt-1 text-sm text-gray-500">
              Se guardará en Stock, dentro de la sección fija &quot;Ingredientes&quot;.
            </p>

            <div className="mt-4 grid gap-4">
              <div>
                <label className="mb-1 block text-xs font-bold uppercase text-gray-600">
                  Nombre del ingrediente
                </label>
                <input
                  type="text"
                  value={stockIngredientDraft.nombre}
                  onChange={(e) =>
                    setStockIngredientDraft((prev) => ({ ...prev, nombre: e.target.value }))
                  }
                  className="w-full rounded-xl border border-gray-200 bg-white px-3 py-3 text-sm text-gray-900 placeholder:text-gray-400 outline-none shadow-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                  placeholder="Ej: Crema de leche"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-bold uppercase text-gray-600">
                  Descripción / texto de etiqueta
                </label>
                <textarea
                  value={stockIngredientDraft.descripcion}
                  onChange={(e) =>
                    setStockIngredientDraft((prev) => ({ ...prev, descripcion: e.target.value }))
                  }
                  className="h-24 w-full resize-none rounded-xl border border-gray-200 bg-white px-3 py-3 text-sm text-gray-900 placeholder:text-gray-400 outline-none shadow-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                  placeholder="Describe el ingrediente o pega texto relevante de la etiqueta"
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
                    onChange={handleStockIngredientImage}
                    className="absolute inset-0 cursor-pointer opacity-0"
                  />
                  {stockIngredientDraft.imagen ? (
                    <Image
                      src={stockIngredientDraft.imagen}
                      alt="Vista previa de etiqueta del ingrediente"
                      width={640}
                      height={360}
                      className="max-h-52 w-auto rounded-xl object-cover"
                    />
                  ) : (
                    <div className="text-center">
                      <Camera className="mx-auto mb-2 h-10 w-10 text-gray-300" />
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
                  value={stockIngredientDraft.instruccionesIA}
                  onChange={(e) =>
                    setStockIngredientDraft((prev) => ({
                      ...prev,
                      instruccionesIA: e.target.value,
                    }))
                  }
                  className="h-20 w-full resize-none rounded-xl border border-blue-200 bg-blue-50 px-3 py-3 text-sm text-blue-900 placeholder:text-blue-400 outline-none shadow-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                  placeholder="Ej: prioriza detección de alérgenos por aditivos"
                />
              </div>
            </div>

            <div className="mt-5 flex flex-wrap gap-3">
              <button
                type="button"
                onClick={handleAnalyzeStockIngredient}
                disabled={analizandoStockIngredient}
                className="inline-flex items-center gap-2 rounded-xl bg-black px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-gray-800 disabled:cursor-not-allowed disabled:bg-gray-300"
              >
                <Send className="h-4 w-4" />
                {analizandoStockIngredient ? "Analizando..." : "Analizar con IA"}
              </button>

              <button
                type="button"
                onClick={handleSaveStockIngredient}
                disabled={!stockIngredientDraft.nombre.trim() || guardandoStockIngredient}
                className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-gray-300"
              >
                <Save className="h-4 w-4" />
                {guardandoStockIngredient ? "Guardando..." : "Guardar ingrediente"}
              </button>
            </div>

            {stockIngredientAnalisis && (
              <div className="mt-4 rounded-2xl border border-gray-100 bg-gray-50 p-4">
                <h4 className="font-bold text-gray-900">Resultado IA</h4>
                <div className="mt-3 grid gap-2 md:grid-cols-2">
                  <div className="rounded-xl bg-red-50 p-3">
                    <p className="text-xs font-bold uppercase tracking-wide text-red-700">Alergenos</p>
                    <p className="mt-1 text-sm text-red-900">
                      {stockIngredientAnalisis.alergenos.length > 0
                        ? stockIngredientAnalisis.alergenos.join(", ")
                        : "Ninguno detectado"}
                    </p>
                  </div>
                  <div className="rounded-xl bg-amber-50 p-3">
                    <p className="text-xs font-bold uppercase tracking-wide text-amber-700">Trazas</p>
                    <p className="mt-1 text-sm text-amber-900">
                      {stockIngredientAnalisis.trazas.length > 0
                        ? stockIngredientAnalisis.trazas.join(", ")
                        : "Sin trazas"}
                    </p>
                  </div>
                </div>
              </div>
            )}

            <div className="mt-5 flex justify-end">
              <button
                type="button"
                onClick={() => {
                  setShowStockIngredientModal(false);
                  resetStockIngredientModal();
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

// PAGE_INFO: Formulario para crear o editar un plato y asociarlo al menú.
