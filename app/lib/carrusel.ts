// Anuncios por secuencia (carrusel).
//
// Límites verificados empíricamente contra la Marketing API el 15 ago 2026, usando
// `execution_options: ["validate_only"]` (Meta valida la petición sin crear nada):
//   - 1 tarjeta  -> "(#194) param child_attachments has too few elements"
//   - 2 a 10     -> válido
//   - 11 o más   -> "(#105) param child_attachments has too many elements"
//
// El mínimo del proyecto es 4, más estricto que el de Meta: un carrusel de 2 o 3
// tarjetas no aporta sobre un anuncio simple, y en inmobiliaria el valor está en
// mostrar varias vistas de la propiedad.

export const MIN_TARJETAS = 4;
export const MAX_TARJETAS = 10;

// Límite duro de Meta, distinto del mínimo que exigimos nosotros.
export const MIN_TARJETAS_META = 2;

export type TarjetaCarrusel = {
  propertyMediaId: string;
  headline: string | null;
  description: string | null;
  orden: number;
};

// Revisa si el carrusel se puede publicar. Devuelve null si está bien, o el motivo.
export function validarCarrusel(tarjetas: { length: number }): string | null {
  if (tarjetas.length < MIN_TARJETAS) {
    return `Un carrusel necesita al menos ${MIN_TARJETAS} fotos y hay ${tarjetas.length}. ` +
      `Sube más fotos a la propiedad o cambia el formato a imagen única.`;
  }
  if (tarjetas.length > MAX_TARJETAS) {
    return `Meta acepta como máximo ${MAX_TARJETAS} tarjetas por carrusel y hay ${tarjetas.length}.`;
  }
  return null;
}

// Cuántas fotos faltan para poder armar un carrusel.
export function fotosFaltantes(disponibles: number): number {
  return Math.max(0, MIN_TARJETAS - disponibles);
}
