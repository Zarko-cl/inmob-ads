// Límites y validación de archivos subidos (M8).
//
// Este archivo es deliberadamente "puro" (sin acceso al disco ni a la red) porque
// lo usan los dos lados: el navegador, para validar antes de subir, y el servidor,
// como respaldo. lib/storage.ts —que sí toca el disco— no puede importarse desde
// el navegador.

// Meta acepta imágenes de hasta 30 MB, pero una foto de propiedad razonable pesa
// mucho menos; 10 MB deja margen de sobra y evita subidas accidentales enormes.
export const MAX_FILE_BYTES = 10 * 1024 * 1024;

export const TIPOS_PERMITIDOS = ["image/jpeg", "image/png", "image/webp"];

export const EXTENSION_POR_TIPO: Record<string, string> = {
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
};

export const TIPO_POR_EXTENSION: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
};

export function formatearBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function validarArchivo(archivo: { size: number; type: string }): string | null {
  if (!TIPOS_PERMITIDOS.includes(archivo.type)) {
    return `Formato no permitido (${archivo.type || "desconocido"}). Usa JPG, PNG o WebP.`;
  }
  if (archivo.size > MAX_FILE_BYTES) {
    return `El archivo pesa ${formatearBytes(archivo.size)} y el máximo es ${formatearBytes(MAX_FILE_BYTES)}.`;
  }
  if (archivo.size === 0) return "El archivo está vacío.";
  return null;
}
