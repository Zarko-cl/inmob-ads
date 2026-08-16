import { readFile } from "fs/promises";
import path from "path";
import { carpetaLocal, proveedorActivo } from "@/lib/storage";
import { TIPO_POR_EXTENSION } from "@/lib/storage-limits";

// Sirve las fotos guardadas en el modo de almacenamiento "local".
// (En modo "vercel-blob" las imágenes las sirve el propio servicio y esta ruta
// no se usa.)
export async function GET(_request: Request, { params }: { params: Promise<{ nombre: string }> }) {
  if (proveedorActivo() !== "local") {
    return new Response("No disponible", { status: 404 });
  }

  const { nombre } = await params;

  // Defensa contra "path traversal": alguien podría pedir /api/archivos/..%2F..%2F.env
  // para leer archivos fuera de la carpeta. basename() se queda solo con el nombre
  // final, y además se exige que calce con el formato que generamos nosotros
  // (UUID + extensión permitida).
  const seguro = path.basename(nombre);
  if (!/^[0-9a-f-]{36}\.(jpg|png|webp)$/i.test(seguro)) {
    return new Response("Nombre de archivo inválido", { status: 400 });
  }

  const extension = path.extname(seguro).toLowerCase();
  const contentType = TIPO_POR_EXTENSION[extension];
  if (!contentType) return new Response("Tipo no permitido", { status: 400 });

  try {
    const contenido = await readFile(path.join(carpetaLocal(), seguro));
    return new Response(new Uint8Array(contenido), {
      headers: {
        "Content-Type": contentType,
        // Las fotos nunca cambian de contenido (cada subida genera un nombre
        // nuevo), así que se pueden cachear de forma agresiva.
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    });
  } catch {
    return new Response("Archivo no encontrado", { status: 404 });
  }
}
