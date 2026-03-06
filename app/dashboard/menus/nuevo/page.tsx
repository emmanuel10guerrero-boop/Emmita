"use client";

import { useCallback, useEffect, useState } from "react";
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
  nombreplato: string | null;
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

  const [menuNombre, setMenuNombre] = useState<string>("");
  const [nombrePlato, setNombrePlato] = useState("");
  const [descripcionPlato, setDescripcionPlato] = useState("");
  const [ingredienteInput, setIngredienteInput] = useState("");
  const [ingredientes, setIngredientes] = useState<string[]>([]);
  const [alergenosSeleccionados, setAlergenosSeleccionados] = useState<string[]>([]);
  const [alergenoInput, setAlergenoInput] = useState("");
  const [imagen, setImagen] = useState<string | null>(null);
  const [notasInternas, setNotasInternas] = useState("");
  const [instruccionesIA, setInstruccionesIA] = useState("");

  const [cargandoAnalisis, setCargandoAnalisis] = useState(false);
  const [guardandoPlato, setGuardandoPlato] = useState(false);
  const [mensajeError, setMensajeError] = useState<string | null>(null);
  const [analisis, setAnalisis] = useState<AnalisisIA | null>(null);
  const [ultimoPlatoId, setUltimoPlatoId] = useState<string | null>(null);
  const [platosMenu, setPlatosMenu] = useState<PlatoListado[]>([]);

  const puedeAnalizar =
    nombrePlato.trim().length > 0 &&
    (imagen !== null || descripcionPlato.trim().length > 0 || ingredientes.length > 0);

  const puedeGuardar = nombrePlato.trim().length > 0;

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

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
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

  const loadPlatosMenu = useCallback(async () => {
    if (!menuId) return;

    const { data: links, error: linksError } = await supabase
      .from("menu_platos")
      .select("plato_id")
      .eq("menu_id", menuId);

    if (linksError || !links || links.length === 0) {
      setPlatosMenu([]);
      return;
    }

    const platoIds = links
      .map((row) => row.plato_id as string | null)
      .filter((id): id is string => Boolean(id));

    if (platoIds.length === 0) {
      setPlatosMenu([]);
      return;
    }

    const { data: platos, error: platosError } = await supabase
      .from("platos")
      .select("id, nombreplato, created_at")
      .in("id", platoIds)
      .order("created_at", { ascending: false });

    if (platosError) {
      setPlatosMenu([]);
      return;
    }

    setPlatosMenu((platos ?? []) as PlatoListado[]);
  }, [menuId]);

  useEffect(() => {
    if (!menuId) return;
    void loadMenuMetadata();
    void loadPlatosMenu();
  }, [menuId, loadMenuMetadata, loadPlatosMenu]);

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
          nombrePlato: nombrePlato.trim(),
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
      descripcionPlato.trim()
        ? `Descripcion declarada: ${descripcionPlato.trim()}`
        : null,
      ingredientes.length > 0
        ? `Ingredientes declarados: ${ingredientes.join(", ")}`
        : null,
      analisis?.justificacion
        ? `Resumen IA: ${analisis.justificacion}`
        : null,
    ]
      .filter(Boolean)
      .join("\n");

    try {
      const { data: nuevoPlato, error: platoError } = await supabase
        .from("platos")
        .insert({
          nombreplato: nombrePlato.trim(),
          restaurante_id: restaurantId,
          alergenos: alergenosSeleccionados,
          trazas: analisis?.trazas ?? [],
          justificacion:
            analisis?.justificacion ?? "Sin análisis IA. Alergenos definidos manualmente.",
          notas_internas: notasCompletas || null,
        })
        .select("id")
        .single();

      if (platoError) throw platoError;

      const { error: linkError } = await supabase.from("menu_platos").insert({
        menu_id: menuId,
        plato_id: nuevoPlato.id,
      });

      if (linkError) throw linkError;

      setUltimoPlatoId(nuevoPlato.id);
      setNombrePlato("");
      setDescripcionPlato("");
      setIngredienteInput("");
      setIngredientes([]);
      setAlergenosSeleccionados([]);
      setAlergenoInput("");
      setImagen(null);
      setNotasInternas("");
      setInstruccionesIA("");
      setAnalisis(null);

      await loadPlatosMenu();
    } catch (error) {
      const message = error instanceof Error ? error.message : "No se pudo guardar";
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
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-black text-gray-900">Agregar Platos al Menú</h1>
            <p className="text-gray-500 font-medium">
              Menú: {menuNombre || "Sin nombre"}
            </p>
          </div>
          <Link
            href="/dashboard/menus"
            className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm font-semibold text-gray-700 shadow-sm transition-all hover:-translate-y-0.5 hover:bg-gray-100"
          >
            <ArrowLeft className="h-4 w-4" />
            Volver a Menús
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
                  Nombre del plato
                </label>
                <input
                  type="text"
                  value={nombrePlato}
                  onChange={(e) => setNombrePlato(e.target.value)}
                  className="w-full rounded-xl border border-gray-200 bg-white px-3 py-3 text-sm text-gray-900 placeholder:text-gray-400 outline-none shadow-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                  placeholder="Ej: Tarta de queso"
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
                {guardandoPlato ? "Guardando..." : "3) Guardar plato en menú"}
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
                        {plato.nombreplato ?? "Plato sin nombre"}
                      </p>
                      <p className="text-xs text-gray-500">
                        {new Date(plato.created_at).toLocaleString()}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {ultimoPlatoId && (
              <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
                <h3 className="text-sm font-bold text-gray-800">Último QR generado</h3>
                <div className="mt-3 flex justify-center">
                  <QRCodeSVG
                    value={`${window.location.origin}/plato/${ultimoPlatoId}`}
                    size={110}
                  />
                </div>
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
