// Miniaturas para mandarle fotos a la IA.
//
// Para escribir el título de cada tarjeta del carrusel, el modelo necesita VER la
// foto (si no, no puede saber que una es la cocina y otra la fachada). Mandar el
// archivo original sería carísimo y lento: una foto de cámara pesa 3 MB y en base64
// crece un 33% más. Con 7 tarjetas serían ~28 MB por petición.
//
// Se reducen a 512 px de lado largo y calidad 60. Es de sobra para que el modelo
// reconozca el ambiente (usamos `detail: "low"`, que internamente trabaja con una
// versión pequeña de todos modos) y deja cada foto en unas decenas de KB.
//
// Usa sharp, la librería estándar de procesamiento de imágenes en Node. Ya venía
// instalada como dependencia de Next (es la que usa su optimizador de imágenes),
// pero se declaró en package.json para no depender de eso.

import sharp from "sharp";
import { leerArchivo } from "@/lib/storage";

const LADO_MAX = 512;
const CALIDAD = 60;

// Devuelve la foto como data URL lista para la API de OpenAI, o null si no se pudo
// leer. Null no es un error fatal: se genera el texto de esa tarjeta sin ver la foto.
export async function miniaturaParaIA(pathname: string, url: string): Promise<string | null> {
  try {
    // leerArchivo necesita la URL además del pathname: en modo vercel-blob el archivo
    // no está en disco y hay que bajarlo del servicio.
    const original = await leerArchivo(pathname, url);
    const reducida = await sharp(original)
      .rotate() // respeta la orientación EXIF de la cámara
      .resize(LADO_MAX, LADO_MAX, { fit: "inside", withoutEnlargement: true })
      .jpeg({ quality: CALIDAD })
      .toBuffer();
    return `data:image/jpeg;base64,${reducida.toString("base64")}`;
  } catch (err) {
    console.error("No se pudo preparar la miniatura para la IA:", err);
    return null;
  }
}
