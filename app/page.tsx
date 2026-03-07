"use client";

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export default function RootPage() {
  const router = useRouter();

  useEffect(() => {
    const checkUser = async () => {
      // Verificamos si hay una sesión activa
      const { data: { session } } = await supabase.auth.getSession();

      if (session) {
        // Si hay usuario, al Dashboard
        router.replace('/dashboard');
      } else {
        // Si no hay usuario, al Login (o registro, según tu ruta)
        router.replace('/registro'); 
      }
    };

    checkUser();
  }, [router]);

  // Mientras verifica, puedes mostrar un spinner o nada
  return (
    <div className="min-h-screen flex items-center justify-center bg-white">
      <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-600"></div>
    </div>
  );
}

