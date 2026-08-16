// Operaciones sobre las fotos de una propiedad que se usan desde más de una ruta:
// borrado (individual o en lote) y reordenamiento.

import { prisma } from "@/lib/prisma";
import { borrarArchivo } from "@/lib/storage";

// Cuenta en cuántas campañas y tarjetas de carrusel se está usando cada foto, para
// poder avisarle al usuario ANTES de que borre algo que va a dejar una campaña sin
// creativo.
export type UsoFoto = { campanas: number; tarjetas: number };

export async function usoDeFotos(propertyId: string): Promise<Record<string, UsoFoto>> {
  const [comoCreativo, comoTarjeta, enAnuncios] = await Promise.all([
    prisma.campaign.groupBy({
      by: ["creativeMediaId"],
      where: { property: { id: propertyId }, creativeMediaId: { not: null } },
      _count: { _all: true },
    }),
    prisma.carouselCard.groupBy({
      by: ["propertyMediaId"],
      where: { media: { propertyId } },
      _count: { _all: true },
    }),
    prisma.ad.groupBy({
      by: ["creativeMediaId"],
      where: { creativeMedia: { propertyId } },
      _count: { _all: true },
    }),
  ]);

  const uso: Record<string, UsoFoto> = {};
  const anotar = (id: string | null, campo: keyof UsoFoto, cantidad: number) => {
    if (!id) return;
    uso[id] ??= { campanas: 0, tarjetas: 0 };
    uso[id][campo] += cantidad;
  };

  for (const f of comoCreativo) anotar(f.creativeMediaId, "campanas", f._count._all);
  for (const f of enAnuncios) anotar(f.creativeMediaId, "campanas", f._count._all);
  for (const f of comoTarjeta) anotar(f.propertyMediaId, "tarjetas", f._count._all);
  return uso;
}

// Borra una o varias fotos de una propiedad. Devuelve cuántas se borraron.
//
// El registro en la base se borra siempre, aunque el archivo físico ya no exista:
// dejar la fila apuntando a un archivo perdido mostraría una foto rota en la ficha.
// Las campañas y anuncios que la usaban quedan sin creativo (la relación es opcional
// y la base la pone en null sola); las tarjetas de carrusel se borran en cascada.
export async function borrarFotos(ids: string[], organizationId: string): Promise<number> {
  if (ids.length === 0) return 0;

  const fotos = await prisma.propertyMedia.findMany({
    where: { id: { in: ids }, property: { organizationId } },
  });
  if (fotos.length === 0) return 0;

  for (const foto of fotos) {
    try {
      await borrarArchivo(foto.pathname);
    } catch (err) {
      console.error("No se pudo borrar el archivo del almacenamiento:", err);
    }
  }

  await prisma.propertyMedia.deleteMany({ where: { id: { in: fotos.map((f) => f.id) } } });
  return fotos.length;
}

// Guarda el orden de las fotos. `idsEnOrden` es la lista completa tal como quedó en
// la pantalla; la posición dentro del arreglo pasa a ser el campo `orden`.
//
// Va en una transacción para que no queden a medio renumerar si algo falla: con
// órdenes duplicados el carrusel saldría en un orden impredecible.
export async function reordenarFotos(
  idsEnOrden: string[],
  propertyId: string,
  organizationId: string
): Promise<number> {
  const fotos = await prisma.propertyMedia.findMany({
    where: { propertyId, property: { organizationId } },
    select: { id: true },
  });
  const validas = new Set(fotos.map((f) => f.id));

  const aActualizar = idsEnOrden.filter((id) => validas.has(id));
  if (aActualizar.length !== fotos.length) {
    throw new Error("La lista de fotos no coincide con las de la propiedad.");
  }

  await prisma.$transaction(
    aActualizar.map((id, orden) =>
      prisma.propertyMedia.update({ where: { id }, data: { orden } })
    )
  );
  return aActualizar.length;
}
