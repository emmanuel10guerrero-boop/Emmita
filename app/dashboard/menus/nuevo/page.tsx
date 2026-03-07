"use client";

import { type ChangeEvent, useCallback, useEffect, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
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

type PlatoListado = {
  id: string;
  nombre?: string | null;
  created_at: string;
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
  const [ingredienteInput, setIngredienteInput] = useState("");
  const [ingredientes, setIngredientes] = useState<string[]>([]);
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
  const [publicMenuUrl, setPublicMenuUrl] = useState<string>("");
  const [platosMenu, setPlatosMenu] = useState<PlatoListado[]>([]);
  const getNombrePlato = (plato: PlatoListado) => plato.nombre ?? "Item sin nombre";

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
    setIngredienteInput("");
  };

  const quitarIngrediente = (ingrediente: string) => {
    setIngredientes((prev) => prev.filter((item) => item !== ingrediente));
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

  const loadPlatosMenu = useCallback(async () => {
    if (!menuId) return;

    const { data: links, error: linksError } = await supabase
      .from("menu_items")
      .select("item_id")
      .eq("menu_id", menuId);

    if (linksError) {
      setMensajeError(`No se pudieron cargar relaciones del menú: ${linksError.message}`);
      setPlatosMenu([]);
      return;
    }

    if (!links || links.length === 0) {
      setPlatosMenu([]);
      return;
    }

    const platoIds = links
      .map((row) => row.item_id as string | null)
      .filter((id): id is string => Boolean(id));

    if (platoIds.length === 0) {
      setPlatosMenu([]);
      return;
    }

    const { data: platos, error: platosError } = await supabase
      .from("items")
      .select("*")
      .in("id", platoIds)
      .order("created_at", { ascending: false });

    if (platosError) {
      setMensajeError(`No se pudieron cargar platos del menú: ${platosError.message}`);
      setPlatosMenu([]);
      return;
    }

    const platosNormalizados = (platos ?? []).map((plato) => ({
      id: plato.id as string,
      nombre: (plato.nombre as string | null | undefined) ?? null,
      created_at: plato.created_at as string,
    }));

    setPlatosMenu(platosNormalizados);
  }, [menuId]);

  useEffect(() => {
    if (!menuId) return;
    void loadMenuMetadata();
    void loadPlatosMenu();
  }, [menuId, loadMenuMetadata, loadPlatosMenu]);

  useEffect(() => {
    const timer = window.setTimeout(async () => {
      const restaurantId = await getRestaurantId();
      if (!restaurantId) return;
      setPublicMenuUrl(`${window.location.origin}/publica?rid=${restaurantId}`);
    }, 0);
    return () => window.clearTimeout(timer);
  }, [getRestaurantId]);

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
      setIngredienteInput("");
      setNotasInternas("");
      setInstruccionesIA("");
      setAnalisis(null);

      await loadPlatosMenu();
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

        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
          <div className="xl:col-span-2 rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
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
                <input
                  type="text"
                  value={seccion}
                  onChange={(e) => setSeccion(e.target.value)}
                  className="w-full rounded-xl border border-gray-200 bg-white px-3 py-3 text-sm text-gray-900 placeholder:text-gray-400 outline-none shadow-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                  placeholder="Ej: Bebidas"
                />
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
                <input
                  type="text"
                  value={ingredienteInput}
                  onChange={(e) => setIngredienteInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      agregarIngrediente(ingredienteInput);
                    }
                  }}
                  className="w-full rounded-xl border border-gray-200 bg-white px-3 py-3 text-sm text-gray-900 placeholder:text-gray-400 outline-none shadow-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                  placeholder="Escribe un ingrediente y presiona Enter"
                />
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

          <div className="space-y-4">
            <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
              <h3 className="text-lg font-bold text-gray-900">Platos en este menú</h3>
              <p className="mt-1 text-sm text-gray-500">{platosMenu.length} plato(s) guardado(s)</p>

              {platosMenu.length === 0 ? (
                <p className="mt-4 text-sm text-gray-500">Todavía no hay platos cargados.</p>
              ) : (
                <div className="mt-4 space-y-2">
                  {platosMenu.map((plato) => (
                    <div
                      key={plato.id}
                      className="rounded-lg border border-gray-100 bg-gray-50 px-3 py-2"
                    >
                      <p className="text-sm font-semibold text-gray-800">
                        {getNombrePlato(plato)}
                      </p>
                      <p className="text-xs text-gray-500">
                        {new Date(plato.created_at).toLocaleString()}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {publicMenuUrl && (
              <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
                <h3 className="text-sm font-bold text-gray-800">QR de página pública</h3>
                <div className="mt-3 flex justify-center">
                  <QRCodeSVG
                    value={publicMenuUrl}
                    size={110}
                  />
                </div>
                <p className="mt-2 text-center text-xs text-gray-500">
                  Este QR abre el menú activo del día.
                </p>
              </div>
            )}
           <Link
              href={`/dashboard/menus/nuevo?menuId=${menuId}`}
              className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-semibold text-gray-700 transition hover:bg-gray-100"
            >
              <Plus className="h-4 w-4" />
              Agregar otro plato
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

// PAGE_INFO: Formulario para crear o editar un plato y asociarlo al menú.
