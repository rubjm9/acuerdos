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

/** Navegación principal (pestañas móviles; el 5.º hueco lo ocupa «Más»). */
export const MAIN_NAV: NavItem[] = [
  { href: "/", label: "Inicio", icon: Home },
  { href: "/busqueda", label: "Buscar", icon: Search },
  { href: "/asistente", label: "Asistente", icon: Sparkles },
  { href: "/tareas", label: "Tareas", icon: CheckSquare },
];

export const SECONDARY_NAV: NavItem[] = [
  { href: "/politicas", label: "Políticas", icon: Library },
  { href: "/expedientes", label: "Expedientes", icon: FolderOpen },
  { href: "/acuerdos", label: "Acuerdos", icon: Gavel },
  { href: "/actas", label: "Actas", icon: FileText },
  { href: "/ingesta", label: "Ingesta", icon: Inbox, roles: ["secretary", "administrator"] },
  { href: "/analitica", label: "Analítica", icon: LineChart },
  { href: "/informes", label: "Informes", icon: BarChart3 },
  { href: "/admin", label: "Administración", icon: Settings, roles: ["administrator"] },
];

export function visibleFor(items: NavItem[], roles: string[]): NavItem[] {
  return items.filter((i) => !i.roles || i.roles.some((r) => roles.includes(r)));
}
