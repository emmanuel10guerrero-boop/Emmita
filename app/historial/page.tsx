'use client';
import { useCallback, useEffect, useState } from 'react';
import { createClient } from '@supabase/supabase-js';
import { useRouter } from 'next/navigation';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export default function HistorialPlatos() {
  type ItemHistorial = {
    id: string;
    nombre: string | null;
    trazas: string[] | string | null;
    justificacion: string | null;
    created_at: string;
  };

  const [platos, setPlatos] = useState<ItemHistorial[]>([]);
  const [cargando, setCargando] = useState(true);
  const [platoSeleccionado, setPlatoSeleccionado] = useState<ItemHistorial | null>(null); // Estado para el modal
  const router = useRouter();

  const getNombrePlato = (plato: ItemHistorial | null) =>
    plato?.nombre ?? 'Item sin nombre';

  const cargarPlatos = useCallback(async () => {
    const restaurantId = localStorage.getItem('restaurantId');
    if (!restaurantId) {
      router.push('/registro');
      return;
    }

    const { data, error } = await supabase
      .from('items')
      .select('*')
      .eq('restaurante_id', restaurantId)
      .order('created_at', { ascending: false });

    if (!error) setPlatos((data || []) as ItemHistorial[]);
    setCargando(false);
  }, [router]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void cargarPlatos();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [cargarPlatos]);

  return (
    <div className="min-h-screen bg-gray-50 p-6 font-sans">
      <div className="max-w-5xl mx-auto">
        {/* CABECERA */}
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-2xl font-bold text-gray-800">Historial de Análisis</h1>
            <p className="text-gray-500 text-sm">Consulta los detalles de tus platos registrados</p>
          </div>
          <button 
            onClick={() => router.push('/')}
            className="bg-blue-600 text-white px-5 py-2 rounded-xl font-medium hover:bg-blue-700 transition shadow-sm"
          >
            + Nuevo Análisis
          </button>
        </div>

        {/* LISTADO */}
        {cargando ? (
          <p className="text-center text-gray-500">Cargando...</p>
        ) : (
          <div className="grid gap-4">
            {platos.map((plato) => (
              <div 
                key={plato.id} 
                onClick={() => setPlatoSeleccionado(plato)} // Al hacer clic, se abre el modal
                className="bg-white p-5 rounded-xl shadow-sm border border-gray-100 flex justify-between items-center cursor-pointer hover:border-blue-300 transition-all hover:shadow-md group"
              >
                <div>
                  <h3 className="text-lg font-bold text-gray-800 group-hover:text-blue-600 transition-colors">
                    {getNombrePlato(plato)}
                  </h3>
                  <p className="text-xs text-gray-400">
                    {new Date(plato.created_at).toLocaleDateString('es-ES', { day: '2-digit', month: 'long', year: 'numeric' })}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-xs font-bold text-blue-500 bg-blue-50 px-2 py-1 rounded">Ver detalles →</span>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* VENTANA MODAL DE DETALLES */}
        {platoSeleccionado && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto shadow-2xl animate-in zoom-in-95 duration-200">
              <div className="p-6 border-b border-gray-100 flex justify-between items-center sticky top-0 bg-white z-10">
                <h2 className="text-xl font-bold text-gray-800">Detalle del Análisis</h2>
                <button 
                  onClick={() => setPlatoSeleccionado(null)}
                  className="text-gray-400 hover:text-gray-600 text-2xl"
                >
                  ✕
                </button>
              </div>
              
              <div className="p-6 space-y-6">
                <div>
                  <label className="text-xs font-bold text-gray-400 uppercase">Plato</label>
                  <p className="text-2xl font-bold text-gray-900">
                    {getNombrePlato(platoSeleccionado)}
                  </p>
                </div>

                <div>
                  <label className="text-xs font-bold text-gray-400 uppercase block mb-2">Trazas Identificadas</label>
                  <p className="bg-amber-50 text-amber-800 p-3 rounded-lg border border-amber-100 text-sm font-medium">
                    ⚠️ {platoSeleccionado.trazas}
                  </p>
                </div>

                <div>
                  <label className="text-xs font-bold text-gray-400 uppercase block mb-2">Justificación de la IA</label>
                  <div className="bg-gray-50 p-4 rounded-lg text-gray-700 text-sm italic leading-relaxed">
                    {platoSeleccionado.justificacion}
                  </div>
                </div>

                <div className="pt-4 border-t border-gray-100 flex justify-between items-center text-xs text-gray-400">
                  <span>ID de Análisis: {platoSeleccionado.id.substring(0,8)}...</span>
                  <span>Registrado el {new Date(platoSeleccionado.created_at).toLocaleDateString()}</span>
                </div>
              </div>

              <div className="p-4 bg-gray-50 rounded-b-2xl">
                <button 
                  onClick={() => setPlatoSeleccionado(null)}
                  className="w-full py-3 bg-gray-800 text-white rounded-xl font-bold hover:bg-gray-900 transition"
                >
                  Cerrar
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// PAGE_INFO: Historial de platos analizados y vista de detalle en modal.
