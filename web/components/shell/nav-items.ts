import {
  Home,
  Search,
  FolderOpen,
  CheckSquare,
  FileText,
  Gavel,
  Inbox,
  BarChart3,
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

/** Navegación principal (los 5 primeros son las pestañas móviles). */
export const MAIN_NAV: NavItem[] = [
  { href: "/", label: "Inicio", icon: Home },
  { href: "/busqueda", label: "Buscar", icon: Search },
  { href: "/expedientes", label: "Expedientes", icon: FolderOpen },
  { href: "/tareas", label: "Tareas", icon: CheckSquare },
];

export const SECONDARY_NAV: NavItem[] = [
  { href: "/acuerdos", label: "Acuerdos", icon: Gavel },
  { href: "/actas", label: "Actas", icon: FileText },
  { href: "/ingesta", label: "Ingesta", icon: Inbox, roles: ["secretary", "administrator"] },
  { href: "/informes", label: "Informes", icon: BarChart3 },
  { href: "/admin", label: "Administración", icon: Settings, roles: ["administrator"] },
];

export function visibleFor(items: NavItem[], roles: string[]): NavItem[] {
  return items.filter((i) => !i.roles || i.roles.some((r) => roles.includes(r)));
}
