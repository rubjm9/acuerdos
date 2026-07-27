"use client";

import { ThemeProvider as NextThemesProvider } from "next-themes";
import type { ComponentProps } from "react";

/**
 * Proveedor de tema (claro/oscuro/sistema) basado en next-themes.
 * Aplica la clase `.dark` en <html>; lo consumen el conmutador del header,
 * el menú de usuario y el Toaster (sonner).
 */
export function ThemeProvider({
  children,
  ...props
}: ComponentProps<typeof NextThemesProvider>) {
  return <NextThemesProvider {...props}>{children}</NextThemesProvider>;
}
