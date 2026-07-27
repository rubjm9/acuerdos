"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Fragment } from "react";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

/** Etiquetas legibles por segmento de ruta (es-ES). */
const SEGMENT_LABELS: Record<string, string> = {
  "": "Inicio",
  busqueda: "Buscar",
  asistente: "Asistente",
  tareas: "Tareas",
  politicas: "Políticas",
  expedientes: "Expedientes",
  acuerdos: "Acuerdos",
  actas: "Actas",
  ingesta: "Ingesta",
  analitica: "Analítica",
  informes: "Informes",
  notificaciones: "Notificaciones",
  admin: "Administración",
  usuarios: "Usuarios",
  areas: "Áreas",
  comites: "Comités",
  auditoria: "Auditoría",
  nueva: "Nueva",
  nuevo: "Nuevo",
  editar: "Editar",
  mine: "Mías",
};

function labelFor(segment: string): string {
  if (SEGMENT_LABELS[segment] !== undefined) return SEGMENT_LABELS[segment];
  // Identificadores (uuid / numérico / job) → ficha
  if (/^[0-9a-f-]{6,}$/i.test(segment) || /^\d+$/.test(segment)) return "Ficha";
  return decodeURIComponent(segment);
}

type Crumb = { href: string; label: string };

export function Breadcrumbs({ className }: { className?: string }) {
  const pathname = usePathname();
  const segments = pathname.split("/").filter(Boolean);

  const crumbs: Crumb[] = [{ href: "/", label: "Inicio" }];
  let acc = "";
  for (const seg of segments) {
    acc += `/${seg}`;
    crumbs.push({ href: acc, label: labelFor(seg) });
  }

  return (
    <nav aria-label="Ruta de navegación" className={cn("flex min-w-0 items-center", className)}>
      <ol className="flex min-w-0 items-center gap-1.5 text-sm">
        {crumbs.map((crumb, i) => {
          const last = i === crumbs.length - 1;
          return (
            <Fragment key={crumb.href}>
              {i > 0 && (
                <ChevronRight className="size-3.5 shrink-0 text-muted-foreground/50" aria-hidden />
              )}
              <li className="min-w-0">
                {last ? (
                  <span aria-current="page" className="truncate font-medium text-foreground">
                    {crumb.label}
                  </span>
                ) : (
                  <Link
                    href={crumb.href}
                    className="truncate text-muted-foreground transition-colors hover:text-foreground"
                  >
                    {crumb.label}
                  </Link>
                )}
              </li>
            </Fragment>
          );
        })}
      </ol>
    </nav>
  );
}
