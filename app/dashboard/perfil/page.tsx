"use client";

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@supabase/supabase-js';
import { 
  User, Mail, MapPin, CreditCard, Edit3, LogOut, ArrowLeft, Loader2, Save, Camera
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
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [restaurantId, setRestaurantId] = useState<string | null>(null);
  const [logoInitialized, setLogoInitialized] = useState(false);
  
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
        const savedLogo = localStorage.getItem(`restaurantLogo:${session.user.id}`);
        setLogoUrl(savedLogo);
        setRestaurantId(session.user.id);
        setLogoInitialized(true);

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

  useEffect(() => {
    if (!restaurantId || !logoInitialized) return;
    const storageKey = `restaurantLogo:${restaurantId}`;
    if (logoUrl) {
      localStorage.setItem(storageKey, logoUrl);
    } else {
      localStorage.removeItem(storageKey);
    }
  }, [logoUrl, restaurantId, logoInitialized]);

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

    if (logoUrl) {
      localStorage.setItem(`restaurantLogo:${session.user.id}`, logoUrl);
    } else {
      localStorage.removeItem(`restaurantLogo:${session.user.id}`);
    }
    
    setEditando(false);
    alert("¡Perfil guardado correctamente! 🎉");
  } catch (error: any) {
    console.error("Error al guardar:", error.message);
    alert("No se pudo guardar: " + error.message);
  } finally {
    setGuardando(false);
  }
};

  const handleLogoChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      alert("Selecciona un archivo de imagen válido.");
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      alert("La imagen no puede superar 5MB.");
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => {
      setLogoUrl(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  if (cargando) return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-50 p-6 text-black">
      <div className="max-w-2xl mx-auto">
        <Link
          href="/dashboard"
          className="mb-8 inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm font-semibold text-gray-700 shadow-sm transition-all hover:-translate-y-0.5 hover:bg-gray-100 hover:shadow-md"
        >
          <ArrowLeft className="h-4 w-4" />
          Volver al Panel
        </Link>

        <div className="bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden">
          {/* HEADER */}
          <div className="bg-gradient-to-r from-blue-600 to-blue-400 p-8 text-white">
            <div className="flex items-center gap-4">
              <div className="shrink-0">
                {editando ? (
                  <label className="relative flex h-20 w-20 cursor-pointer items-center justify-center overflow-hidden rounded-2xl border border-white/40 bg-white/20 backdrop-blur-md transition hover:bg-white/30">
                    {logoUrl ? (
                      <img src={logoUrl} alt="Logo del restaurante" className="h-full w-full object-cover" />
                    ) : (
                      <div className="flex flex-col items-center justify-center">
                        <Camera className="h-5 w-5 text-white" />
                        <span className="mt-1 text-[9px] font-bold uppercase tracking-wide text-white">
                          Añadir Logo
                        </span>
                      </div>
                    )}
                    <input type="file" accept="image/*" className="hidden" onChange={handleLogoChange} />
                  </label>
                ) : (
                  <div className="flex h-20 w-20 items-center justify-center overflow-hidden rounded-2xl border border-white/40 bg-white/20 backdrop-blur-md">
                    {logoUrl ? (
                      <img src={logoUrl} alt="Logo del restaurante" className="h-full w-full object-cover" />
                    ) : (
                      <User className="h-10 w-10 text-white" />
                    )}
                  </div>
                )}
              </div>
              <div className="min-w-0">
                <h1 className="text-2xl font-black">{editando ? "Editando Perfil" : perfil.nombre}</h1>
                <p className="text-blue-100 opacity-80 text-sm font-medium">Gestiona los datos de tu restaurante</p>
              </div>
            </div>
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
