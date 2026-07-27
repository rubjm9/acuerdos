import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Salida autónoma para la imagen Docker (web/Dockerfile)
  output: "standalone",
  // pg y los SDK de AWS se cargan en runtime Node, no se empaquetan
  serverExternalPackages: ["pg", "pg-boss", "nodemailer", "web-push"],
  // Transiciones de vista de React entre navegaciones (fluidez)
  experimental: {
    viewTransition: true,
  },
};

export default nextConfig;
