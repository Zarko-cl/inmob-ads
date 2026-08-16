"use client";

// Campo de texto de un copy con contador de caracteres en vivo (M7).
// Corre en el navegador para que el contador reaccione mientras se escribe.

import { useState } from "react";
import { COPY_LIMITS, revisarCampo, type CopyField } from "@/lib/copy-limits";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";

type Props = {
  campo: CopyField;
  name: string;
  defaultValue?: string;
  filas?: number;
};

export function CampoCopy({ campo, name, defaultValue = "", filas = 3 }: Props) {
  const [valor, setValor] = useState(defaultValue);
  const limites = COPY_LIMITS[campo];
  const check = revisarCampo(campo, valor);

  const colorContador = check.excedeMaximo
    ? "text-destructive"
    : check.excedeRecomendado || check.bajoMinimoRecomendado
      ? "text-amber-400"
      : "text-muted-foreground";

  return (
    <div className="space-y-1.5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <Label htmlFor={`${name}-${campo}`}>{limites.label}</Label>
        <span className={`text-xs ${colorContador}`}>
          {check.largo}/{limites.recomendado}
          {check.excedeMaximo && ` — supera el máximo de Meta (${limites.maximo})`}
          {!check.excedeMaximo && check.excedeRecomendado && " — Meta lo corta con “Ver más”"}
          {check.bajoMinimoRecomendado && ` — corto, Meta recomienda desde ${limites.minimoRecomendado}`}
        </span>
      </div>

      {/* La barra muestra de un vistazo qué tan cerca está del límite. */}
      <div className="h-1 overflow-hidden rounded-full bg-muted">
        <div
          className={`h-full rounded-full transition-all duration-300 ${
            check.excedeMaximo
              ? "bg-destructive"
              : check.excedeRecomendado
                ? "bg-amber-400"
                : "bg-gradient-to-r from-primary to-chart-2"
          }`}
          style={{ width: `${Math.min((check.largo / limites.recomendado) * 100, 100)}%` }}
        />
      </div>

      <Textarea
        id={`${name}-${campo}`}
        name={name}
        rows={filas}
        value={valor}
        onChange={(e) => setValor(e.target.value)}
        className={check.excedeMaximo ? "border-destructive" : undefined}
      />
    </div>
  );
}
