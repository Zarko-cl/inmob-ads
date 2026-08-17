// Límites y validación de archivos subidos (M8).
//
// Este archivo es deliberadamente "puro" (sin acceso al disco ni a la red) porque
// lo usan los dos lados: el navegador, para validar antes de subir, y el servidor,
// como respaldo. lib/storage.ts —que sí toca el disco— no puede importarse desde
// el navegador.

// Meta acepta imágenes de hasta 30 MB, pero el límite real lo pone el servidor:
// las funciones de Vercel (donde corre la app desplegada) rechazan cualquier
// petición cuyo cuerpo pase de 4,5 MB, y la foto viaja dentro de esa petición.
// Ese tope es de la plataforma: no se puede subir por configuración.
//
// Por eso el máximo es 4 MB y no 10: deja ~500 KB de margen para lo que el
// formulario agrega alrededor del archivo. Con más, la subida fallaría recién en
// el servidor, después de esperar, y con un error poco claro.
//
// Una foto de propiedad bien exportada pesa bastante menos que esto; las que se
// pasan son fotos que salen directo de la cámara sin comprimir.
export const MAX_FILE_BYTES = 4 * 1024 * 1024;

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
    return `El archivo pesa ${formatearBytes(archivo.size)} y el máximo es ${formatearBytes(MAX_FILE_BYTES)}. Reduce su tamaño y vuelve a intentarlo.`;
  }
  if (archivo.size === 0) return "El archivo está vacío.";
  return null;
}
