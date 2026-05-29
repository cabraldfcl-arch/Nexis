import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    background_color: "#f6f7f4",
    description: "Gestor financeiro mobile-first com IA assistida para pequenos negocios.",
    display: "standalone",
    icons: [
      {
        purpose: "any",
        sizes: "any",
        src: "/icons/nexis-icon.svg",
        type: "image/svg+xml",
      },
      {
        purpose: "maskable",
        sizes: "any",
        src: "/icons/nexis-maskable.svg",
        type: "image/svg+xml",
      },
    ],
    name: "NEXIS",
    orientation: "portrait",
    scope: "/",
    short_name: "NEXIS",
    start_url: "/",
    theme_color: "#064e3b",
  };
}
