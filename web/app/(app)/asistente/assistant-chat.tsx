"use client";

import { Fragment, useRef, useState } from "react";
import Link from "next/link";
import { ArrowUp, FileText, Library, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

type Source = {
  kind: "acuerdo" | "politica";
  id: string;
  ref: string;
  titulo: string;
  href: string;
  cita: string;
  fecha: string | null;
};

type Turn = {
  question: string;
  answer: string;
  sources: Source[];
  done: boolean;
  error?: boolean;
};

const SUGERENCIAS = [
  "¿Qué se decidió sobre el centro de Llíria?",
  "Resume el histórico del inmueble de Llíria",
  "¿Qué acuerdos hay sobre traducciones?",
];

/**
 * Renderiza el texto del asistente convirtiendo las citas [ACU-AAAA-NNNN] en
 * enlaces al acuerdo correspondiente cuando está entre las fuentes.
 */
function AnswerText({ text, sources }: { text: string; sources: Source[] }) {
  const byRef = new Map(sources.map((s) => [s.ref, s.href]));
  // Divide por tokens de cita de acuerdo [ACU-AAAA-NNNN] o de política [POL-NNNN].
  const parts = text.split(/(\[(?:ACU-\d{4}-\d{4}|POL-\d{4})\])/g);
  return (
    <>
      {parts.map((part, i) => {
        const m = part.match(/^\[((?:ACU-\d{4}-\d{4}|POL-\d{4}))\]$/);
        if (m && byRef.has(m[1])) {
          return (
            <Link
              key={i}
              href={byRef.get(m[1])!}
              className="mx-0.5 inline-flex items-center rounded bg-accent px-1.5 py-0.5 text-xs font-medium text-primary no-underline hover:bg-accent/70"
            >
              {m[1]}
            </Link>
          );
        }
        return <Fragment key={i}>{part}</Fragment>;
      })}
    </>
  );
}

export function AssistantChat({ llmEnabled }: { llmEnabled: boolean }) {
  const [turns, setTurns] = useState<Turn[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  async function ask(question: string) {
    if (!question.trim() || busy) return;
    setBusy(true);
    setInput("");
    const idx = turns.length;
    setTurns((t) => [...t, { question, answer: "", sources: [], done: false }]);

    try {
      const res = await fetch("/api/asistente", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question }),
      });
      if (!res.body) throw new Error("sin cuerpo");

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let headerParsed = false;

      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        if (!headerParsed) {
          const nl = buffer.indexOf("\n");
          if (nl === -1) continue;
          const header = JSON.parse(buffer.slice(0, nl)) as { sources: Source[] };
          buffer = buffer.slice(nl + 1);
          headerParsed = true;
          setTurns((t) =>
            t.map((turn, i) => (i === idx ? { ...turn, sources: header.sources } : turn))
          );
        }
        const answer = buffer;
        setTurns((t) => t.map((turn, i) => (i === idx ? { ...turn, answer } : turn)));
        scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
      }
      setTurns((t) => t.map((turn, i) => (i === idx ? { ...turn, done: true } : turn)));
    } catch {
      setTurns((t) =>
        t.map((turn, i) =>
          i === idx
            ? { ...turn, done: true, error: true, answer: "No se pudo obtener respuesta." }
            : turn
        )
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      {!llmEnabled ? (
        <p className="rounded-xl bg-muted/60 px-4 py-3 text-sm text-muted-foreground">
          El modelo de lenguaje autoalojado no está activo en este entorno. El asistente
          mostrará las fuentes más relevantes de tu consulta; cuando el nodo de IA esté
          desplegado, redactará también la respuesta citada.
        </p>
      ) : null}

      {turns.length === 0 ? (
        <div className="space-y-3">
          <div className="flex flex-wrap gap-2">
            {SUGERENCIAS.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => ask(s)}
                className="rounded-full border px-3.5 py-2 text-sm text-muted-foreground transition-colors hover:border-ring/50 hover:text-foreground"
              >
                {s}
              </button>
            ))}
          </div>
        </div>
      ) : null}

      <div ref={scrollRef} className="space-y-6">
        {turns.map((turn, i) => (
          <div key={i} className="space-y-3">
            <div className="flex justify-end">
              <div className="max-w-[85%] rounded-2xl rounded-br-sm bg-primary px-4 py-2.5 text-sm text-primary-foreground">
                {turn.question}
              </div>
            </div>
            <div className="space-y-3">
              <div className="flex items-start gap-2.5">
                <div className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full bg-accent">
                  <Sparkles className="size-4 text-primary" aria-hidden />
                </div>
                <div className="min-w-0 flex-1 whitespace-pre-wrap text-[15px] leading-relaxed">
                  {turn.answer ? (
                    <AnswerText text={turn.answer} sources={turn.sources} />
                  ) : (
                    <span className="text-muted-foreground">Pensando…</span>
                  )}
                </div>
              </div>

              {turn.sources.length > 0 ? (
                <div className="ml-9.5 space-y-1.5">
                  <div className="text-xs font-medium text-muted-foreground">Fuentes</div>
                  <ul className="space-y-1.5">
                    {turn.sources.map((s) => (
                      <li key={`${s.kind}-${s.id}`}>
                        <Link
                          href={s.href}
                          className="flex items-start gap-2 rounded-lg border bg-card px-3 py-2 text-sm transition-colors hover:ring-ring/40"
                        >
                          {s.kind === "politica" ? (
                            <Library className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />
                          ) : (
                            <FileText className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />
                          )}
                          <span className="min-w-0">
                            <span className="font-medium">{s.titulo}</span>
                            <span className="block text-xs text-muted-foreground">
                              {s.ref} · {s.cita}
                            </span>
                          </span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </div>
          </div>
        ))}
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          ask(input);
        }}
        className="sticky bottom-20 mt-2 md:bottom-4"
      >
        <div className="flex items-end gap-2 rounded-xl bg-card p-2 ring-1 ring-foreground/10">
          <Textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                ask(input);
              }
            }}
            placeholder="Pregunta sobre acuerdos, expedientes o el histórico…"
            rows={1}
            className="max-h-32 min-h-10 resize-none border-0 bg-transparent shadow-none focus-visible:ring-0"
            aria-label="Pregunta al asistente"
          />
          <Button
            type="submit"
            size="icon"
            disabled={busy || !input.trim()}
            className="size-10 shrink-0 rounded-xl"
            aria-label="Enviar"
          >
            <ArrowUp className="size-5" aria-hidden />
          </Button>
        </div>
        <p className="mt-2 px-1 text-center text-xs text-muted-foreground">
          El asistente responde solo con acuerdos que puedes ver y cita su acta y página.
        </p>
      </form>
    </div>
  );
}
