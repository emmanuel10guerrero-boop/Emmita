"use client";

import { useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { useRouter, useSearchParams } from 'next/navigation';
import { createClient } from '@supabase/supabase-js';
import { ArrowLeft, Camera, Send, Printer } from 'lucide-react';
import Link from 'next/link';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export default function AgregarPlatoPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const menuId = searchParams.get("menuId");
  const [nombre, setNombre] = useState("");
  const [imagen, setImagen] = useState<string | null>(null);
  const [notas, setNotas] = useState(""); // Notas internas
  const [comentariosIA, setComentariosIA] = useState(""); // Instrucciones para la IA
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

  const analizarPlato = async () => {
    if (!nombre || !imagen) return alert("Por favor, rellena el nombre y sube una foto.");
    if (!menuId) {
      alert("No se encontró el menú actual.");
      return;
}

    const idDeLaBaseDeDatos = localStorage.getItem('restaurantId');
    if (!idDeLaBaseDeDatos) {
      router.push('/registro');
      return;
    }

    setCargando(true);
    try {
      // Enviamos el nombre, la imagen Y los comentarios extras a la IA
      const response = await fetch('/api/analizar-plato', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nombrePlato: nombre,
          imagenBase64: imagen,
          restaurantId: idDeLaBaseDeDatos,
          instruccionesExtra: comentariosIA // Nueva prop para tu API
        }),
      });

      const resultadoIA = await response.json();

      if (response.ok) {
        // Guardamos en Supabase incluyendo tus notas personales
        const { data, error } = await supabase
          .from('platos')
          .insert([{
            nombreplato: nombre,
            restaurante_id: idDeLaBaseDeDatos,
            alergenos: resultadoIA.alergenos,
            trazas: resultadoIA.trazas,
            justificacion: resultadoIA.justificacion,
            notas_internas: notas // Guardamos tus notas
          }])
          .select()
          .single();

        if (error) {
          console.error("Error al guardar:", error);
          setResultado(resultadoIA);
        } else {
          const { error: menuPlatoError } = await supabase
            .from("menu_platos")
            .insert({
              menu_id: menuId,
              plato_id: data.id,
            });

          if (menuPlatoError) {
            console.error("Error vinculando plato al menú:", menuPlatoError);
          }

          setResultado({ ...resultadoIA, id: data.id });
        }
      }
    } catch (error) {
      alert("Error de conexión");
    } finally {
      setCargando(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-3xl mx-auto space-y-6">
        
        {/* BOTÓN VOLVER */}
        <Link href="/dashboard/menus" className="flex items-center text-gray-500 hover:text-black transition-colors w-fit">
          <ArrowLeft className="w-5 h-5 mr-2" />
          Volver a Mis Menús
        </Link>

        <div className="bg-white p-8 rounded-3xl shadow-sm border border-gray-100 space-y-8">
          <h2 className="text-2xl font-black text-gray-800">Nuevo Análisis de Plato</h2>

          {/* INPUTS PRINCIPALES */}
          <div className="grid grid-cols-1 gap-6">
            <div>
              <label className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2 block">Nombre del Plato</label>
              <input
                type="text"
                className="w-full bg-gray-50 border-none p-4 rounded-2xl text-gray-900 focus:ring-2 focus:ring-blue-500 outline-none font-medium"
                placeholder="Ej: Tarta de Queso con Arándanos"
                value={nombre}
                onChange={(e) => setNombre(e.target.value)}
              />
            </div>

            <div>
              <label className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2 block">Foto del Plato</label>
              <div className="relative group flex flex-col items-center justify-center border-2 border-dashed border-gray-200 rounded-3xl p-8 hover:bg-blue-50/50 hover:border-blue-200 transition-all cursor-pointer">
                <input type="file" onChange={handleImageChange} className="absolute inset-0 opacity-0 cursor-pointer" />
                {imagen ? (
                  <img src={imagen} className="w-full max-h-64 object-cover rounded-2xl shadow-md" />
                ) : (
                  <div className="text-center">
                    <Camera className="w-12 h-12 text-gray-300 mx-auto mb-3 group-hover:text-blue-500 transition-colors" />
                    <p className="text-sm text-gray-500 font-semibold">Haz clic para subir o arrastra la foto</p>
                  </div>
                )}
              </div>
            </div>

            {/* SECCIÓN DE NOTAS Y COMENTARIOS */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2 block">Notas del Plato (Internas)</label>
                <textarea
                  className="w-full bg-gray-50 border-none p-4 rounded-2xl text-sm h-32 resize-none"
                  placeholder="Ej: Plato estrella del chef, precio 12€..."
                  value={notas}
                  onChange={(e) => setNotas(e.target.value)}
                />
              </div>
              <div>
                <label className="text-xs font-bold text-blue-400 uppercase tracking-wider mb-2 block italic">Instrucciones para la IA</label>
                <textarea
                  className="w-full bg-blue-50/30 border border-blue-100 p-4 rounded-2xl text-sm h-32 resize-none text-blue-900"
                  placeholder="Ej: Analiza si la salsa lleva soja escondida..."
                  value={comentariosIA}
                  onChange={(e) => setComentariosIA(e.target.value)}
                />
              </div>
            </div>
          </div>

          <button
            onClick={analizarPlato}
            disabled={cargando}
            className={`w-full py-5 rounded-2xl font-black text-lg text-white transition-all shadow-xl flex items-center justify-center gap-3 ${cargando ? 'bg-gray-400' : 'bg-black hover:bg-gray-800 active:scale-95'}`}
          >
            {cargando ? <span className="animate-pulse">Analizando Ingredientes...</span> : <><Send className="w-5 h-5" /> GENERAR INFORME IA</>}
          </button>
        </div>

        {/* REPORTE (Aparece aquí abajo al terminar) */}
        {resultado && (
          <div className="animate-in fade-in slide-in-from-top-4 duration-500 bg-white rounded-3xl shadow-2xl border border-gray-100 overflow-hidden">
             {/* ... (Aquí va todo tu diseño de la tarjeta de resultado que ya tenías) ... */}
             <div className="p-8">
                <h3 className="text-2xl font-black mb-4 flex items-center gap-2">
                   Resultado del Análisis {resultado.id && <QRCodeSVG value={`${window.location.origin}/plato/${resultado.id}`} size={40} />}
                </h3>
                <div className="space-y-4">
                  <div className="p-4 bg-red-50 rounded-xl">
                    <p className="font-bold text-red-700">Alérgenos:</p>
                    <p className="text-red-900">{resultado.alergenos?.join(', ') || 'Ninguno'}</p>
                  </div>
                  <div className="p-4 bg-gray-50 rounded-xl">
                    <p className="font-bold">Justificación:</p>
                    <p className="text-sm">{resultado.justificacion}</p>
                  </div>
                </div>
             </div>
          </div>
        )}
      </div>
    </div>
  );
}