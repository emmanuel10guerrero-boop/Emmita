import { NextResponse } from 'next/server';
import OpenAI from 'openai';

// Configuración de Next.js (Siempre después de los imports)
export const maxDuration = 60; 
export const dynamic = 'force-dynamic';

function extractFirstJsonObject(raw: string): string {
  const trimmed = raw.trim();
  if (trimmed.startsWith("{") && trimmed.endsWith("}")) return trimmed;

  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  if (fenced?.[1]) return fenced[1].trim();

  const firstBrace = trimmed.indexOf("{");
  const lastBrace = trimmed.lastIndexOf("}");
  if (firstBrace >= 0 && lastBrace > firstBrace) {
    return trimmed.slice(firstBrace, lastBrace + 1).trim();
  }

  return trimmed;
}

function toStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => (typeof item === "string" ? item.trim() : ""))
    .filter(Boolean);
}

export async function POST(req: Request) {
  try {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Falta OPENAI_API_KEY en el entorno del servidor. Configúrala en .env.local y reinicia el servidor.",
        },
        { status: 500 }
      );
    }

    const openai = new OpenAI({ apiKey });

    const {
      nombrePlato,
      imagenBase64,
      descripcionPlato,
      etiquetasIngredientes,
      instruccionesExtra,
    } = await req.json();

    if (!nombrePlato || typeof nombrePlato !== "string") {
      return NextResponse.json(
        { success: false, error: "Falta nombrePlato" },
        { status: 400 }
      );
    }

    const ingredientes = Array.isArray(etiquetasIngredientes)
      ? etiquetasIngredientes.filter(
          (item: unknown): item is string =>
            typeof item === "string" && item.trim().length > 0
        )
      : [];

    const promptBase = [
      `Nombre del plato: ${nombrePlato}`,
      `Descripcion del plato: ${descripcionPlato || "No especificada"}`,
      `Ingredientes/etiquetas declaradas: ${
        ingredientes.length > 0 ? ingredientes.join(", ") : "No especificadas"
      }`,
      instruccionesExtra
        ? `Instrucciones adicionales del restaurante: ${instruccionesExtra}`
        : null,
      'Analiza posibles alergenos y trazas, considerando descripcion, ingredientes declarados y foto (si existe).',
      'Responde estrictamente en JSON con este formato: {"alergenos":[],"trazas":[],"justificacion":""}.',
    ]
      .filter(Boolean)
      .join("\n");

    const userContent: Array<
      | { type: "text"; text: string }
      | { type: "image_url"; image_url: { url: string } }
    > = [{ type: "text", text: promptBase }];

    if (typeof imagenBase64 === "string" && imagenBase64.trim().length > 0) {
      userContent.push({
        type: "image_url",
        image_url: { url: imagenBase64 },
      });
    }

    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "user",
          content: userContent,
        },
      ],
      response_format: { type: "json_object" },
    });

    const contenido = response.choices[0].message.content;
    if (!contenido) throw new Error("La IA no devolvió contenido");

    let resultadoIA: unknown;
    try {
      resultadoIA = JSON.parse(extractFirstJsonObject(contenido));
    } catch {
      throw new Error("La IA devolvió una respuesta no válida en formato JSON");
    }

    const parsed = resultadoIA as {
      alergenos?: unknown;
      trazas?: unknown;
      justificacion?: unknown;
    };

    return NextResponse.json({
      alergenos: toStringArray(parsed.alergenos),
      trazas: toStringArray(parsed.trazas),
      justificacion:
        typeof parsed.justificacion === "string"
          ? parsed.justificacion
          : "Sin justificación",
      success: true,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Error desconocido";
    console.error("❌ Error detallado:", message);
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}
