'use client';
import { useEffect, useState } from 'react';
import { createClient } from '@supabase/supabase-js';
import { useParams } from 'next/navigation';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export default function PaginaPublicaPlato() {
  const { id } = useParams();
  const [plato, setPlato] = useState<any>(null);

  useEffect(() => {
    const obtenerPlato = async () => {
      const { data } = await supabase
        .from('platos')
        .select('*, restaurantes(nombre_establecimiento)')
        .eq('id', id)
        .single();
      setPlato(data);
    };
    obtenerPlato();
  }, [id]);

  if (!plato) return <div className="p-10 text-center">Cargando información...</div>;

  return (
    <div className="min-h-screen bg-white p-6 font-sans">
      <div className="max-w-md mx-auto border-2 border-green-500 rounded-3xl p-6 shadow-xl">
        <div className="text-center mb-6">
          <span className="bg-green-100 text-green-700 text-xs font-bold px-3 py-1 rounded-full uppercase">Informe Seguro</span>
          <h1 className="text-3xl font-black text-gray-900 mt-2">{plato.nombre_plato}</h1>
          <p className="text-gray-500 text-sm">Restaurante: {plato.restaurantes?.nombre_establecimiento}</p>
        </div>

        <div className="space-y-6">
          <div className="bg-amber-50 p-4 rounded-2xl border border-amber-100">
            <h3 className="text-amber-800 font-bold mb-1 flex items-center gap-2">⚠️ Trazas y Advertencias</h3>
            <p className="text-amber-900 text-sm">{plato.trazas}</p>
          </div>

          <div className="bg-blue-50 p-4 rounded-2xl border border-blue-100">
            <h3 className="text-blue-800 font-bold mb-1">🔍 Análisis del Chef IA</h3>
            <p className="text-blue-900 text-sm italic">{plato.justificacion}</p>
          </div>
        </div>
        
        <p className="text-[10px] text-gray-400 text-center mt-8">
          Este informe ha sido generado por IA para fines informativos. 
          Consulte siempre con el personal del local.
        </p>
      </div>
    </div>
  );
}