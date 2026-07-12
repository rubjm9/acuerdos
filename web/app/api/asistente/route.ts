import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { audit } from "@/lib/audit";
import {
  retrieveContext,
  buildMessages,
  streamLLM,
  citation,
  llmEnabled,
  type ContextPassage,
} from "@/lib/assistant";

/**
 * Asistente NL. Protocolo de respuesta (streaming, text/plain):
 *   línea 1: JSON con {sources, llm} terminado en \n
 *   resto:   texto de la respuesta en tiempo real (tokens del LLM)
 *
 * Sin LLM configurado, la primera línea trae llm:false y el cuerpo es un aviso.
 * La recuperación es RLS-scoped: nunca aparece contenido de áreas restringidas.
 */

const bodySchema = z.object({ question: z.string().trim().min(3).max(500) });

function sourcePayload(p: ContextPassage) {
  return {
    acuerdo_id: p.acuerdo_id,
    public_ref: p.public_ref,
    titulo: p.titulo,
    acta_id: p.acta_id,
    cita: citation(p),
    fecha: p.fecha_adopcion.slice(0, 10),
  };
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }

  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Pregunta no válida" }, { status: 400 });
  }
  const { question } = parsed.data;
  const userId = session.user.id;

  const passages = await retrieveContext(userId, question);

  await audit(userId, "search", "asistente", null, {
    metadata: { question, passages: passages.length, llm: llmEnabled() },
  });

  const encoder = new TextEncoder();
  const header =
    JSON.stringify({ sources: passages.map(sourcePayload), llm: llmEnabled() }) + "\n";

  // Sin LLM: devolvemos las fuentes y un aviso (feature útil como búsqueda guiada).
  if (!llmEnabled()) {
    const aviso =
      passages.length > 0
        ? "El modelo de lenguaje no está disponible en este entorno. Estas son las " +
          "fuentes más relevantes para tu pregunta; ábrelas para leer el detalle."
        : "El modelo de lenguaje no está disponible y no se han encontrado acuerdos " +
          "relevantes para tu pregunta.";
    return new Response(header + aviso, {
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  }

  // Con LLM: streaming. Anteponemos la cabecera de fuentes y luego los tokens.
  let llmStream: ReadableStream<Uint8Array>;
  try {
    llmStream = await streamLLM(buildMessages(question, passages));
  } catch {
    return new Response(
      header +
        "No se pudo contactar con el modelo de lenguaje. Consulta las fuentes " +
        "relevantes mostradas o inténtalo de nuevo.",
      { headers: { "Content-Type": "text/plain; charset=utf-8" } }
    );
  }

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      controller.enqueue(encoder.encode(header));
      const reader = llmStream.getReader();
      try {
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          controller.enqueue(value);
        }
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Accel-Buffering": "no",
    },
  });
}
