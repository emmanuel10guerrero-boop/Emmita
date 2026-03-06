"use client";

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@supabase/supabase-js';
import { 
  User, Mail, MapPin, CreditCard, Edit3, LogOut, ArrowLeft, Loader2, Save, X 
} from 'lucide-react';
import Link from 'next/link';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export default function PerfilPage() {
  const router = useRouter();
  const [cargando, setCargando] = useState(true);
  const [editando, setEditando] = useState(false);
  const [guardando, setGuardando] = useState(false);
  
  const [perfil, setPerfil] = useState({
    nombre: "",
    email: "",
    direccion: "",
    suscripcion: "Plan Pro"
  });

  useEffect(() => {
    const cargarDatos = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) return router.push('/registro');

        // Buscamos los datos usando el ID de la sesión directamente
        const { data: restaurante, error } = await supabase
          .from('restaurantes')
          .select('nombre_restaurante, direccion')
          .eq('id', session.user.id)
          .maybeSingle(); // No da error si no encuentra nada
        
        if (error) console.error("Error al traer datos:", error.message);

        setPerfil({
          nombre: restaurante?.nombre_restaurante || "Mi Restaurante",
          email: session.user.email || "session.user.email no disponible",
          direccion: restaurante?.direccion || "Sin dirección",
          suscripcion: "Plan Pro"
        });
      } catch (err) {
        console.error("Error crítico:", err);
      } finally {
        setCargando(false);
      }
    };
    cargarDatos();
  }, [router]);

  const handleGuardar = async () => {
  setGuardando(true);
  
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) throw new Error("No hay sesión activa");

    const { error } = await supabase
      .from('restaurantes')
      .upsert({ 
        id: session.user.id,
        nombre_restaurante: perfil.nombre,
        direccion: perfil.direccion,
        // AÑADIMOS ESTO:
        email: session.user.email // Tomamos el email directamente de la sesión
      }, { onConflict: 'id' });

    if (error) throw error;
    
    setEditando(false);
    alert("¡Perfil guardado correctamente! 🎉");
  } catch (error: any) {
    console.error("Error al guardar:", error.message);
    alert("No se pudo guardar: " + error.message);
  } finally {
    setGuardando(false);
  }
};

  if (cargando) return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-50 p-6 text-black">
      <div className="max-w-2xl mx-auto">
        <Link href="/dashboard" className="flex items-center text-gray-500 hover:text-black mb-8 transition-colors w-fit font-medium">
          <ArrowLeft className="w-5 h-5 mr-2" /> Volver al Panel
        </Link>

        <div className="bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden">
          {/* HEADER */}
          <div className="bg-gradient-to-r from-blue-600 to-blue-400 p-8 text-white">
            <div className="w-20 h-20 bg-white/20 backdrop-blur-md rounded-2xl flex items-center justify-center mb-4">
              <User className="w-10 h-10 text-white" />
            </div>
            <h1 className="text-2xl font-black">{editando ? "Editando Perfil" : perfil.nombre}</h1>
            <p className="text-blue-100 opacity-80 text-sm font-medium">Gestiona los datos de tu restaurante</p>
          </div>

          <div className="p-8 space-y-6">
            {/* NOMBRE */}
            <div className={`flex items-center gap-4 p-4 rounded-2xl transition-all border ${editando ? 'bg-white border-blue-500 ring-2 ring-blue-50' : 'bg-gray-50/50 border-transparent'}`}>
              <div className="bg-blue-50 p-3 rounded-xl"><User className="w-5 h-5 text-blue-600" /></div>
              <div className="flex-1">
                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Nombre del Restaurante</p>
                {editando ? (
                  <input 
                    className="w-full bg-transparent border-none p-0 focus:ring-0 font-bold text-gray-800 outline-none"
                    value={perfil.nombre}
                    onChange={(e) => setPerfil({...perfil, nombre: e.target.value})}
                  />
                ) : (
                  <p className="text-gray-800 font-bold">{perfil.nombre}</p>
                )}
              </div>
            </div>

            {/* EMAIL */}
            <div className="flex items-center gap-4 p-4 bg-gray-100/50 rounded-2xl border border-transparent opacity-70 cursor-not-allowed">
              <div className="bg-purple-50 p-3 rounded-xl"><Mail className="w-5 h-5 text-purple-600" /></div>
              <div>
                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Correo Electrónico</p>
                <p className="text-gray-800 font-bold">{perfil.email}</p>
              </div>
            </div>

            {/* DIRECCIÓN */}
            <div className={`flex items-center gap-4 p-4 rounded-2xl transition-all border ${editando ? 'bg-white border-blue-500 ring-2 ring-blue-50' : 'bg-gray-50/50 border-transparent'}`}>
              <div className="bg-orange-50 p-3 rounded-xl"><MapPin className="w-5 h-5 text-orange-600" /></div>
              <div className="flex-1">
                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Dirección Física</p>
                {editando ? (
                  <input 
                    className="w-full bg-transparent border-none p-0 focus:ring-0 font-bold text-gray-800 outline-none"
                    value={perfil.direccion}
                    onChange={(e) => setPerfil({...perfil, direccion: e.target.value})}
                  />
                ) : (
                  <p className="text-gray-800 font-bold">{perfil.direccion}</p>
                )}
              </div>
            </div>

            {/* SUSCRIPCIÓN */}
            <div className="flex items-center gap-4 p-4 bg-gray-50/50 rounded-2xl border border-transparent">
              <div className="bg-green-50 p-3 rounded-xl"><CreditCard className="w-5 h-5 text-green-600" /></div>
              <div className="flex-1">
                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Suscripción</p>
                <div className="flex items-center justify-between">
                  <p className="text-gray-800 font-bold">{perfil.suscripcion}</p>
                  <span className="bg-green-100 text-green-700 text-[10px] font-black px-2 py-0.5 rounded-full uppercase">Activo</span>
                </div>
              </div>
            </div>

            {/* BOTONES */}
            <div className="pt-6 border-t border-gray-100 flex flex-col gap-3">
              {editando ? (
                <div className="flex gap-3">
                   <button 
                    onClick={handleGuardar}
                    disabled={guardando}
                    className="flex-1 bg-blue-600 hover:bg-blue-700 text-white p-4 rounded-2xl font-bold flex items-center justify-center gap-2 transition-all shadow-lg shadow-blue-100"
                  >
                    {guardando ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
                    Guardar Cambios
                  </button>
                  <button 
                    onClick={() => setEditando(false)}
                    className="bg-gray-100 hover:bg-gray-200 text-gray-600 px-6 rounded-2xl font-bold transition-all"
                  >
                    Cancelar
                  </button>
                </div>
              ) : (
                <button 
                  onClick={() => setEditando(true)}
                  className="w-full bg-black hover:bg-gray-800 text-white p-4 rounded-2xl font-bold flex items-center justify-center gap-2 transition-all"
                >
                  <Edit3 className="w-5 h-5" /> Editar Perfil
                </button>
              )}

              <button 
                onClick={async () => { await supabase.auth.signOut(); localStorage.clear(); router.push('/registro'); }}
                className="w-full bg-red-50 hover:bg-red-100 text-red-600 p-4 rounded-2xl font-bold flex items-center justify-center gap-2 transition-all"
              >
                <LogOut className="w-5 h-5" /> Cerrar Sesión
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}