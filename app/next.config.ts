import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  turbopack: {
    root: path.join(__dirname),
  },
  images: {
    // Optimización de imágenes: las fotos de propiedades son fotos de cámara de
    // varios MB, y mostrarlas completas en una miniatura de 250 px es la razón por
    // la que la galería tardaba. Con next/image, Next genera bajo demanda una
    // versión del tamaño que realmente se ve (y en WebP/AVIF, que pesan menos),
    // la guarda en caché y la reutiliza. El archivo original queda intacto: es el
    // que se le manda a Meta al publicar el anuncio.
    //
    // localPatterns restringe qué rutas propias se pueden optimizar. Sin esto,
    // cualquiera podría usar nuestro optimizador contra rutas que no queremos.
    localPatterns: [{ pathname: "/api/archivos/**", search: "" }],
    // Cuando el almacenamiento pase a Vercel Blob (M13) las URLs serán externas y
    // hay que autorizarlas explícitamente.
    remotePatterns: [{ protocol: "https", hostname: "*.public.blob.vercel-storage.com" }],
    formats: ["image/avif", "image/webp"],
    // Las fotos ya subidas no cambian nunca (cada subida genera un nombre nuevo),
    // así que la versión optimizada se puede cachear por mucho tiempo.
    minimumCacheTTL: 31536000,
  },
};

export default nextConfig;
