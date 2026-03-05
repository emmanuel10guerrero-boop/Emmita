import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import OpenAI from 'openai';

// Configuración de Next.js (Siempre después de los imports)
export const maxDuration = 60; 
export const dynamic = 'force-dynamic';

// Inicialización de clientes
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function POST(req: Request) {
  try {
    const { nombrePlato, restaurantId, imagenBase64 } = await req.json();

    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "user",
          content: [
            { 
              type: "text", 
              text: "Analiza los alérgenos de este plato. Responde estrictamente en formato JSON con esta estructura: { \"alergenos\": [], \"trazas\": [], \"justificacion\": \"\" }" 
            },
            {
              type: "image_url",
              image_url: {
                url: imagenBase64,
              },
            },
          ],
        },
      ],
      response_format: { type: "json_object" },
    });

    const contenido = response.choices[0].message.content;
    if (!contenido) throw new Error("La IA no devolvió contenido");

    const resultadoIA = JSON.parse(contenido); 

    // Guardado en Supabase con el truco 'as any' para evitar líos de tipos
   // ... (Mantén todo igual hasta el insert)

    const { data, error } = await (supabase
      .from('platos') as any)
      .insert([
        { 
          nombre: nombrePlato, 
          restaurante_id: restaurantId,
          alergenos: resultadoIA.alergenos,
          trazas: resultadoIA.trazas,
          justificacion: resultadoIA.justificacion 
        }
      ])
      .select();

    if (error) throw error;

    // --- CAMBIO AQUÍ ---
    // Enviamos un solo objeto que contiene el ID de la DB y los datos de la IA
    return NextResponse.json({ 
      id: data[0].id,        // Entregamos el ID para el código QR
      ...resultadoIA,        // "Esparcimos" alergenos, trazas y justificacion al primer nivel
      success: true 
    });

  } catch (err: any) {
    console.error("❌ Error detallado:", err.message);
    return NextResponse.json(
      { success: false, error: err.message }, 
      { status: 500 }
    );
  }
}
