'use client';
import { useState } from 'react';
import { createClient } from '@supabase/supabase-js';
import { useRouter } from 'next/navigation';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export default function PaginaAuth() {
  const [esLogin, setEsLogin] = useState(true); // Controla si es Login o Registro
  const [nombre, setNombre] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [cargando, setCargando] = useState(false);
  const router = useRouter();

  const manejarAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setCargando(true);

    if (esLogin) {
      // --- LÓGICA DE LOGIN ---
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        alert('Error al entrar: ' + error.message);
      } else {
        localStorage.setItem('restaurantId', data.user?.id || '');
        router.push('/');
      }
    } else {
      // --- LÓGICA DE REGISTRO (La que ya tenías) ---
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email,
        password,
      });

      if (authError) {
        alert('Error: ' + authError.message);
      } else {
        await supabase.from('restaurantes').insert([{ 
          id: authData.user?.id, 
          nombre_restaurante: nombre, 
          email: email 
        }]);
        localStorage.setItem('restaurantId', authData.user?.id || '');
        router.push('/');
      }
    }
    setCargando(false);
  };

  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4 text-white font-sans">
      <div className="bg-slate-800 p-8 rounded-2xl shadow-xl w-full max-w-md border border-slate-700">
        <h1 className="text-2xl font-bold text-center mb-2">
          {esLogin ? '¡Bienvenido de nuevo!' : 'Crea tu cuenta'}
        </h1>
        <p className="text-slate-400 text-center mb-8 text-sm">
          {esLogin ? 'Introduce tus credenciales para acceder' : 'Registra tu restaurante en segundos'}
        </p>

        <form onSubmit={manejarAuth} className="space-y-4">
          {!esLogin && (
            <div>
              <label className="block text-sm mb-1">Nombre del Restaurante</label>
              <input 
                type="text" 
                required 
                value={nombre} 
                onChange={(e) => setNombre(e.target.value)} 
                className="w-full p-3 rounded-lg bg-slate-900 border border-slate-700 text-white"
                placeholder="Ej: La Pizzería"
              />
            </div>
          )}

          <div>
            <label className="block text-sm mb-1">Email</label>
            <input 
              type="email" 
              required 
              value={email} 
              onChange={(e) => setEmail(e.target.value)} 
              className="w-full p-3 rounded-lg bg-slate-900 border border-slate-700 text-white"
              placeholder="correo@ejemplo.com"
            />
          </div>

          <div>
            <label className="block text-sm mb-1">Contraseña</label>
            <input 
              type="password" 
              required 
              value={password} 
              onChange={(e) => setPassword(e.target.value)} 
              className="w-full p-3 rounded-lg bg-slate-900 border border-slate-700 text-white"
              placeholder="••••••••"
            />
          </div>

          <button 
            type="submit" 
            disabled={cargando}
            className="w-full py-3 bg-blue-600 hover:bg-blue-700 rounded-lg font-bold transition-all disabled:opacity-50"
          >
            {cargando ? 'Procesando...' : esLogin ? 'Entrar' : 'Registrarse'}
          </button>
        </form>

        <div className="mt-6 text-center">
          <button 
            onClick={() => setEsLogin(!esLogin)} 
            className="text-blue-400 hover:text-blue-300 text-sm font-medium"
          >
            {esLogin ? '¿No tienes cuenta? Regístrate aquí' : '¿Ya tienes cuenta? Inicia sesión'}
          </button>
        </div>
      </div>
    </div>
  );
}
// PAGE_INFO: Registro del restaurante/usuario para habilitar el sistema.
