// Límites de caracteres de los textos de anuncios de Meta (M7 del plan de trabajo).
//
// Hay dos números distintos por campo y conviene no confundirlos:
// - "recomendado": a partir de ahí Meta corta el texto con "... Ver más" en el feed,
//   así que lo importante del mensaje debe caber antes.
// - "máximo": lo que la API acepta sin rechazar el anuncio.

// "minimoRecomendado" solo aplica al título: Meta recomienda 27-40 caracteres, y
// uno más corto desaprovecha el espacio del anuncio (no es un error, solo se ve pobre).
export const COPY_LIMITS = {
  primaryText: { recomendado: 125, maximo: 2200, minimoRecomendado: 0, label: "Texto principal" },
  headline: { recomendado: 40, maximo: 255, minimoRecomendado: 27, label: "Título" },
  description: { recomendado: 30, maximo: 255, minimoRecomendado: 0, label: "Descripción" },
} as const;

export type CopyField = keyof typeof COPY_LIMITS;

export type CopyCheck = {
  largo: number;
  excedeRecomendado: boolean;
  excedeMaximo: boolean;
  bajoMinimoRecomendado: boolean;
};

export function revisarCampo(campo: CopyField, texto: string): CopyCheck {
  const largo = texto.trim().length;
  const limites = COPY_LIMITS[campo];
  return {
    largo,
    excedeRecomendado: largo > limites.recomendado,
    excedeMaximo: largo > limites.maximo,
    bajoMinimoRecomendado: largo > 0 && largo < limites.minimoRecomendado,
  };
}

// Un copy es publicable si ningún campo supera el máximo duro de Meta.
// Superar el "recomendado" solo se advierte, no bloquea.
export function copyEsValido(copy: { primaryText: string; headline: string; description?: string | null }) {
  return (
    !revisarCampo("primaryText", copy.primaryText).excedeMaximo &&
    !revisarCampo("headline", copy.headline).excedeMaximo &&
    !revisarCampo("description", copy.description ?? "").excedeMaximo
  );
}
