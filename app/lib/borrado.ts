// Borrado de campañas y estrategias, con protección contra borrados accidentales.
//
// Regla del proyecto: borrar exige que el usuario ESCRIBA una palabra. Un botón de
// "¿estás seguro?" se acepta por reflejo; escribir obliga a detenerse. La validación
// va en el servidor, no solo en el navegador.

import { prisma } from "@/lib/prisma";
import { eliminarEnMeta } from "@/lib/meta-sync";

export const PALABRA_CONFIRMACION = "borrar";

export function confirmacionValida(texto: unknown): boolean {
  return String(texto ?? "").trim().toLowerCase() === PALABRA_CONFIRMACION;
}

type CampanaBorrable = {
  id: string;
  name: string;
  metaCampaignId: string | null;
};

export type ResultadoBorrado = {
  borradasEnMeta: number;
  soloLocales: number;
  errores: string[];
};

// Borra una campaña en Meta y después el registro local.
//
// Si falla el borrado en Meta, NO se borra localmente: dejar el registro permite
// reintentar. Si se borrara igual, la campaña quedaría huérfana en la cuenta
// publicitaria y nadie sabría que existe.
export async function borrarCampanas(
  campanas: CampanaBorrable[],
  accessToken: string | null
): Promise<ResultadoBorrado> {
  const resultado: ResultadoBorrado = { borradasEnMeta: 0, soloLocales: 0, errores: [] };

  for (const campana of campanas) {
    if (campana.metaCampaignId && accessToken) {
      try {
        // Borrar la campaña en Meta arrastra sus conjuntos y anuncios.
        await eliminarEnMeta({ accessToken, metaObjectId: campana.metaCampaignId });
        resultado.borradasEnMeta++;
      } catch (err) {
        const mensaje = err instanceof Error ? err.message : "error desconocido";
        resultado.errores.push(`${campana.name}: ${mensaje}`);
        continue; // no se borra localmente para poder reintentar
      }
    } else {
      // Nunca llegó a Meta (quedó en borrador): solo hay registro local.
      resultado.soloLocales++;
    }

    // El schema tiene onDelete: Cascade, así que esto arrastra conjuntos, anuncios,
    // copys y revisiones de cumplimiento.
    await prisma.campaign.delete({ where: { id: campana.id } });
  }

  return resultado;
}
