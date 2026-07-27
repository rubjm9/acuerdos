import {
  Home,
  Search,
  FolderOpen,
  CheckSquare,
  FileText,
  Gavel,
  Inbox,
  BarChart3,
  LineChart,
  Library,
  Sparkles,
  Settings,
  type LucideIcon,
} from "lucide-react";

export type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  /** visible solo para estos roles (undefined = todos) */
  roles?: string[];
};

// --- Items (fuente única) ---------------------------------------------------
const INICIO: NavItem = { href: "/", label: "Inicio", icon: Home };
const BUSCAR: NavItem = { href: "/busqueda", label: "Buscar", icon: Search };
const ASISTENTE: NavItem = { href: "/asistente", label: "Asistente", icon: Sparkles };
const TAREAS: NavItem = { href: "/tareas", label: "Tareas", icon: CheckSquare };
const POLITICAS: NavItem = { href: "/politicas", label: "Políticas", icon: Library };
const EXPEDIENTES: NavItem = { href: "/expedientes", label: "Expedientes", icon: FolderOpen };
const ACUERDOS: NavItem = { href: "/acuerdos", label: "Acuerdos", icon: Gavel };
const ACTAS: NavItem = { href: "/actas", label: "Actas", icon: FileText };
const INGESTA: NavItem = { href: "/ingesta", label: "Ingesta", icon: Inbox, roles: ["secretary", "administrator"] };
const ANALITICA: NavItem = { href: "/analitica", label: "Analítica", icon: LineChart };
const INFORMES: NavItem = { href: "/informes", label: "Informes", icon: BarChart3 };
const ADMIN: NavItem = { href: "/admin", label: "Administración", icon: Settings, roles: ["administrator"] };

/** Navegación principal (pestañas móviles; el 5.º hueco lo ocupa «Más»). */
export const MAIN_NAV: NavItem[] = [INICIO, BUSCAR, ASISTENTE, TAREAS];

export const SECONDARY_NAV: NavItem[] = [
  POLITICAS,
  EXPEDIENTES,
  ACUERDOS,
  ACTAS,
  INGESTA,
  ANALITICA,
  INFORMES,
  ADMIN,
];

/**
 * Grupos de la barra lateral (escritorio). Secciones con encabezado para
 * orientar en un dominio con muchas áreas. Reutiliza los mismos items; el
 * filtrado por rol se aplica en el render con `visibleFor`.
 */
export type NavGroup = { label?: string; items: NavItem[] };

export const SIDEBAR_GROUPS: NavGroup[] = [
  { items: [INICIO, BUSCAR, ASISTENTE] },
  { label: "Archivo", items: [ACTAS, ACUERDOS, EXPEDIENTES, POLITICAS] },
  { label: "Seguimiento", items: [TAREAS, ANALITICA, INFORMES] },
  { label: "Sistema", items: [INGESTA, ADMIN] },
];

export function visibleFor(items: NavItem[], roles: string[]): NavItem[] {
  return items.filter((i) => !i.roles || i.roles.some((r) => roles.includes(r)));
}
