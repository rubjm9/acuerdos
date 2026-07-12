/** Vocabulario del dominio: etiquetas es-ES y estilos de estado. */

export const ACUERDO_ESTADOS = {
  en_vigor: "En vigor",
  en_curso: "En curso",
  cumplido: "Cumplido",
  superado: "Superado",
  anulado: "Anulado",
} as const;
export type AcuerdoEstado = keyof typeof ACUERDO_ESTADOS;

export const TAREA_ESTADOS = {
  abierta: "Abierta",
  en_progreso: "En progreso",
  completada: "Completada",
  vencida: "Vencida",
  cancelada: "Cancelada",
} as const;
export type TareaEstado = keyof typeof TAREA_ESTADOS;

export const LINK_TIPOS = {
  deriva_de: "Deriva de",
  continua: "Continúa",
  modifica: "Modifica",
  sustituye_a: "Sustituye a",
  relacionado_con: "Relacionado con",
} as const;
export type LinkTipo = keyof typeof LINK_TIPOS;

/** Sentido inverso para mostrar el enlace desde el otro extremo. */
export const LINK_TIPOS_INVERSO: Record<LinkTipo, string> = {
  deriva_de: "Origen de",
  continua: "Continuado por",
  modifica: "Modificado por",
  sustituye_a: "Sustituido por",
  relacionado_con: "Relacionado con",
};

export const ROLES = {
  administrator: "Administración",
  secretary: "Secretaría",
  member: "Miembro",
  committee: "Comité/Agencia",
  readonly: "Solo lectura",
} as const;
export type Role = keyof typeof ROLES;

export const ACTA_ESTADOS = {
  borrador: "Borrador",
  definitiva: "Definitiva",
  archivada: "Archivada",
} as const;

export const EXPEDIENTE_ESTADOS = {
  abierto: "Abierto",
  cerrado: "Cerrado",
} as const;

/** Clases de color del badge por estado (fondo suave + texto AA; nunca solo color). */
export const ESTADO_BADGE: Record<AcuerdoEstado | TareaEstado, string> = {
  en_vigor: "bg-status-vigor-bg text-status-vigor",
  en_curso: "bg-status-curso-bg text-status-curso",
  cumplido: "bg-status-cumplido-bg text-status-cumplido",
  superado: "bg-status-superado-bg text-status-superado",
  anulado: "bg-status-anulado-bg text-status-anulado",
  abierta: "bg-status-vigor-bg text-status-vigor",
  en_progreso: "bg-status-curso-bg text-status-curso",
  completada: "bg-status-cumplido-bg text-status-cumplido",
  vencida: "bg-status-anulado-bg text-status-anulado",
  cancelada: "bg-status-superado-bg text-status-superado",
};

/**
 * Fecha en formato YYYY-MM-DD usando la zona LOCAL (pg devuelve las columnas
 * date como Date a medianoche local; toISOString() restaría un día).
 */
export function toDateInput(d: string | Date | null | undefined): string {
  if (!d) return "";
  const date = typeof d === "string" ? new Date(d) : d;
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function formatFecha(d: string | Date | null | undefined): string {
  if (!d) return "—";
  const date = typeof d === "string" ? new Date(d) : d;
  return new Intl.DateTimeFormat("es-ES", { day: "numeric", month: "short", year: "numeric" }).format(date);
}

export function formatFechaLarga(d: string | Date | null | undefined): string {
  if (!d) return "—";
  const date = typeof d === "string" ? new Date(d) : d;
  return new Intl.DateTimeFormat("es-ES", { day: "numeric", month: "long", year: "numeric" }).format(date);
}
