// Acceso al almacenamiento de archivos (M8). SOLO SERVIDOR: usa el disco.
// Para validar en el navegador, importar lib/storage-limits.ts.
//
// Hay dos proveedores y se elige con la variable de entorno STORAGE_PROVIDER:
//
//   "local"       (por defecto) — los archivos se guardan en una carpeta de este
//                 computador y los sirve la propia app en /api/archivos/<nombre>.
//                 No requiere cuenta en ningún servicio: es lo que usamos mientras
//                 el desarrollo es local.
//   "vercel-blob" — los archivos se guardan en Vercel Blob (nube). Requiere
//                 BLOB_READ_WRITE_TOKEN. Se activa cuando se despliegue (M13).
//
// El resto del proyecto NO sabe cuál está activo: todo pasa por guardarArchivo() y
// borrarArchivo(). Migrar a Cloudflare R2 o AWS S3 sería agregar un caso más acá.

import { randomUUID } from "crypto";
import { mkdir, writeFile, unlink, readFile } from "fs/promises";
import path from "path";
import { EXTENSION_POR_TIPO } from "@/lib/storage-limits";

export function proveedorActivo(): "local" | "vercel-blob" {
  return process.env.STORAGE_PROVIDER === "vercel-blob" ? "vercel-blob" : "local";
}

export function carpetaLocal(): string {
  // Por defecto, una carpeta "uploads" al lado del código (está en .gitignore).
  return process.env.UPLOADS_DIR ?? path.join(process.cwd(), "uploads");
}

export function storageConfigurado(): boolean {
  if (proveedorActivo() === "vercel-blob") {
    // Al conectar el store, Vercel inyecta credenciales OIDC de corta duración
    // (BLOB_STORE_ID) y además un token largo de respaldo (BLOB_READ_WRITE_TOKEN).
    // Cualquiera de los dos alcanza; fuera de Vercel solo existe el segundo.
    return Boolean(process.env.BLOB_READ_WRITE_TOKEN || process.env.BLOB_STORE_ID);
  }
  // El modo local no necesita configuración, pero SOLO sirve en un computador.
  // Las funciones de Vercel tienen el disco en solo lectura (salvo /tmp, que se
  // borra entre invocaciones), así que ahí guardarArchivo() fallaría a mitad de
  // la subida. Vale más avisarlo antes: la UI ya muestra un aviso y desactiva el
  // botón cuando esto devuelve false.
  return process.env.VERCEL !== "1";
}

export type ArchivoGuardado = {
  url: string; // para mostrar la imagen en el navegador
  pathname: string; // identificador interno, necesario para poder borrarla después
};

export async function guardarArchivo(archivo: File): Promise<ArchivoGuardado> {
  // Nombre propio y aleatorio: nunca se usa el nombre original del archivo, porque
  // podría traer caracteres raros, rutas ("../") o pisar una foto existente.
  const extension = EXTENSION_POR_TIPO[archivo.type] ?? ".jpg";
  const nombre = `${randomUUID()}${extension}`;
  const bytes = Buffer.from(await archivo.arrayBuffer());

  if (proveedorActivo() === "vercel-blob") {
    const { put } = await import("@vercel/blob");
    const blob = await put(nombre, bytes, { access: "public", contentType: archivo.type });
    return { url: blob.url, pathname: blob.pathname };
  }

  const carpeta = carpetaLocal();
  await mkdir(carpeta, { recursive: true });
  await writeFile(path.join(carpeta, nombre), bytes);
  return { url: `/api/archivos/${nombre}`, pathname: nombre };
}

// Devuelve el contenido del archivo. Se usa para reenviar la imagen a Meta al
// crear el creativo del anuncio (M8 parte 2).
export async function leerArchivo(pathname: string, url: string): Promise<Buffer> {
  if (proveedorActivo() === "vercel-blob") {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`No se pudo leer la imagen del almacenamiento (HTTP ${res.status}).`);
    return Buffer.from(await res.arrayBuffer());
  }
  return readFile(path.join(carpetaLocal(), path.basename(pathname)));
}

export async function borrarArchivo(pathname: string): Promise<void> {
  if (proveedorActivo() === "vercel-blob") {
    const { del } = await import("@vercel/blob");
    await del(pathname);
    return;
  }
  await unlink(path.join(carpetaLocal(), path.basename(pathname)));
}
