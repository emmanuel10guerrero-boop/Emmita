"use client";

import { useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { useRouter } from 'next/navigation';
import { createClient } from '@supabase/supabase-js';

// Configuración de Supabase
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export default function PaginaAnalizador() {
  const router = useRouter();
  const [nombre, setNombre] = useState("");
  const [imagen, setImagen] = useState<string | null>(null);
  const [cargando, setCargando] = useState(false);
  const [resultado, setResultado] = useState<any>(null);

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => setImagen(reader.result as string);
      reader.readAsDataURL(file);
    }
  };

  const cerrarSesion = async () => {
    await supabase.auth.signOut();
    localStorage.removeItem('restaurantId');
    router.push('/registro');
  };

  const analizarPlato = async () => {
    if (!nombre || !imagen) return alert("Por favor, rellena el nombre y sube una foto.");

    const idDeLaBaseDeDatos = localStorage.getItem('restaurantId');
    if (!idDeLaBaseDeDatos) {
      router.push('/registro');
      return;
    }

    setCargando(true);
    setResultado(null);

    try {
      // 1. Llamada a la API de la IA
      const response = await fetch('/api/analizar-plato', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nombrePlato: nombre,
          imagenBase64: imagen,
          restaurantId: idDeLaBaseDeDatos
        }),
      });

      const resultadoIA = await response.json();

      if (response.ok) {
        // 2. Guardar en Supabase
        const { data, error } = await supabase
          .from('platos')
          .insert([{
            nombreplato: nombre,
            restaurante_id: idDeLaBaseDeDatos,
            alergenos: resultadoIA.alergenos,
            trazas: resultadoIA.trazas,
            justificacion: resultadoIA.justificacion
          }])
          .select()
          .single();

        if (error) {
          console.error("Error al guardar en DB:", error);
          setResultado(resultadoIA); // Mostramos el informe aunque falle el QR
        } else {
          // 3. Éxito: Guardamos el informe + el ID para el QR
          setResultado({ ...resultadoIA, id: data.id });
        }
      } else {
        alert("Error de la IA: " + (resultadoIA.error || "Fallo en el análisis"));
      }
    } catch (error) {
      console.error("Error crítico:", error);
      alert("Error de conexión");
    } finally {
      setCargando(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto p-6 space-y-8 text-black">
      {/* SECCIÓN DE FORMULARIO */}
      <div className="bg-white p-6 rounded-xl shadow-md border border-gray-100 space-y-6">

        <div className="flex justify-end gap-4">
          <button
            onClick={() => router.push('/historial')}
            className="text-sm font-medium text-blue-600 hover:text-blue-800 bg-blue-50 px-3 py-1.5 rounded-lg transition-colors"
          >
            📋 Ver Historial
          </button>

          <button
            onClick={cerrarSesion}
            className="text-sm font-medium text-red-500 hover:text-red-700 bg-red-50 px-3 py-1.5 rounded-lg transition-colors"
          >
            🚪 Cerrar Sesión
          </button>
        </div>

        <h2 className="text-xl font-bold text-gray-800 text-center">Registrar Nuevo Plato</h2>

        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-2 uppercase">Nombre del Plato</label>
          <input
            type="text"
            className="w-full border border-gray-300 p-3 rounded-xl text-gray-900 focus:ring-2 focus:ring-blue-500 outline-none"
            placeholder="Ej: Croquetas de Jamón"
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
          />
        </div>

        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-2 uppercase">Foto del Plato</label>
          <div className="flex flex-col items-center justify-center border-2 border-dashed border-gray-200 rounded-2xl p-6 hover:bg-gray-50 transition-colors relative cursor-pointer">
            <input
              type="file"
              onChange={handleImageChange}
              className="absolute inset-0 opacity-0 cursor-pointer"
            />
            {imagen ? (
              <img src={imagen} className="w-48 h-48 object-cover rounded-lg border shadow-sm" />
            ) : (
              <div className="text-center">
                <span className="text-4xl block mb-2">📸</span>
                <p className="text-sm text-gray-500 font-medium">Pulsa para subir la foto</p>
              </div>
            )}
          </div>
        </div>

        <button
          onClick={analizarPlato}
          disabled={cargando}
          className={`w-full py-4 rounded-2xl font-bold text-white transition-all shadow-lg ${cargando ? 'bg-gray-400 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700 active:scale-95'}`}
        >
          {cargando ? "⏳ Analizando ingredientes..." : "🚀 Generar Informe y QR"}
        </button>
      </div>

      {/* RESULTADOS REDISEÑADOS ESTILO TARJETA DE PRODUCTO */}
      {resultado && (
        <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 bg-white rounded-2xl shadow-2xl border border-gray-100 overflow-hidden">

          {/* Encabezado con QR a la derecha */}
          <div className="flex justify-between items-start p-6 bg-gradient-to-r from-gray-50 to-white border-b border-gray-100">
            <div className="space-y-1">
              <span className="px-2 py-1 bg-green-100 text-green-700 text-[10px] font-black uppercase rounded-md">
                Análisis Completado
              </span>
              <h3 className="text-2xl font-black text-gray-800 tracking-tight">
                {nombre || "Informe del Plato"}
              </h3>
              <p className="text-sm text-gray-500 font-medium">ID Registro: #{resultado.id?.toString().slice(0, 8)}</p>
            </div>

            {/* QR Pequeño a la derecha */}
            <div className="flex flex-col items-center gap-2">
              <div className="p-2 bg-white border-2 border-blue-50 rounded-xl shadow-sm">
                {resultado.id ? (
                  <QRCodeSVG
                    value={`${window.location.origin}/plato/${resultado.id}`}
                    size={80} // Tamaño más pequeño y elegante
                  />
                ) : (
                  <div className="w-20 h-20 bg-gray-100 animate-pulse rounded-lg" />
                )}
              </div>
              <span className="text-[9px] font-bold text-blue-600 uppercase tracking-tighter">Escanear Menú</span>
            </div>
          </div>

          {/* Cuerpo del informe */}
          <div className="p-6 space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Columna Alérgenos */}
              <div className="space-y-3">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest flex items-center gap-2">
                  <div className="w-1.5 h-1.5 bg-red-500 rounded-full"></div>
                  Alérgenos Detectados
                </label>
                <div className="flex flex-wrap gap-2">
                  {Array.isArray(resultado.alergenos) && resultado.alergenos.length > 0 ? (
                    resultado.alergenos.map((a: string, i: number) => (
                      <span key={i} className="px-3 py-1.5 bg-red-50 text-red-700 rounded-lg text-xs font-bold border border-red-100 shadow-sm">
                        {a}
                      </span>
                    ))
                  ) : (
                    <span className="text-sm text-gray-400 italic">No se detectaron alérgenos</span>
                  )}
                </div>
              </div>

              {/* Columna Trazas */}
              <div className="space-y-3">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest flex items-center gap-2">
                  <div className="w-1.5 h-1.5 bg-amber-500 rounded-full"></div>
                  Posibles Trazas
                </label>
                <div className="flex flex-wrap gap-2">
                  {Array.isArray(resultado.trazas) ? (
                    resultado.trazas.map((t: string, i: number) => (
                      <span key={i} className="px-3 py-1.5 bg-amber-50 text-amber-700 rounded-lg text-xs font-bold border border-amber-100 shadow-sm">
                        {t}
                      </span>
                    ))
                  ) : (
                    <span className="px-3 py-1.5 bg-amber-50 text-amber-700 rounded-lg text-xs font-bold border border-amber-100 uppercase italic">
                      {resultado.trazas || "Ninguna"}
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Justificación de la IA */}
            <div className="mt-4 p-4 bg-blue-50/50 rounded-xl border border-blue-100">
              <h4 className="text-[10px] font-bold text-blue-800 uppercase mb-2">Análisis Técnico de Ingredientes</h4>
              <p className="text-sm text-gray-700 leading-relaxed leading-snug">
                {resultado.justificacion}
              </p>
            </div>
          </div>

          {/* Botón de acción rápida */}
          <div className="p-4 bg-gray-50 flex justify-center">
            <button
              onClick={() => window.print()}
              className="text-xs font-bold text-gray-500 hover:text-blue-600 transition-colors flex items-center gap-2"
            >
              <span>🖨️</span> IMPRIMIR ETIQUETA PARA COCINA
            </button>
          </div>
        </div>
      )}
    </div>
  );
}