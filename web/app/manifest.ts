import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Acuerdos — Plataforma de Gobernanza",
    short_name: "Acuerdos",
    description: "Gestión de actas, acuerdos, expedientes y tareas",
    start_url: "/",
    display: "standalone",
    background_color: "#fbfbfd",
    theme_color: "#fbfbfd",
    lang: "es",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icons/icon-512-maskable.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
