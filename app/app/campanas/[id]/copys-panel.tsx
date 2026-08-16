"use client";

// Panel de copys del detalle de campaña (M7): botón para generar variantes con IA
// y tarjetas editables con contador de caracteres.

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Sparkles, Check, Trash2, Save } from "lucide-react";
import { CampoCopy } from "@/app/components/campo-copy";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

type Variante = {
  id: string;
  primaryText: string;
  headline: string;
  description: string | null;
  generatedBy: string;
  approved: boolean;
};

export function CopysPanel({ campaignId, variantes }: { campaignId: string; variantes: Variante[] }) {
  const router = useRouter();
  const [generando, setGenerando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function generar() {
    setGenerando(true);
    setError(null);
    try {
      const res = await fetch("/api/copys/generar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ campaignId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "No se pudieron generar los copys.");
      // refresh() vuelve a pedir la página al servidor para mostrar las variantes
      // recién guardadas, sin perder el estado del resto de la pantalla.
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error desconocido");
    } finally {
      setGenerando(false);
    }
  }

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-medium">Copys del anuncio</h2>
        <Button type="button" onClick={generar} disabled={generando} size="sm">
          <Sparkles className={`size-4 ${generando ? "animate-pulse" : ""}`} />
          {generando ? "Generando…" : variantes.length > 0 ? "Generar más" : "Generar copy con IA"}
        </Button>
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      {variantes.length === 0 && !generando && (
        <div className="rounded-xl border border-dashed border-border p-8 text-center">
          <Sparkles className="mx-auto mb-3 size-7 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">
            Todavía no hay copys. El texto se genera a partir de los datos de la propiedad vinculada y
            del tipo de campaña.
          </p>
        </div>
      )}

      <div className="grid gap-4">
        {variantes.map((v, i) => (
          <form
            key={v.id}
            method="POST"
            action={`/api/copys/${v.id}`}
            className={`space-y-4 rounded-xl border bg-card p-5 ${
              v.approved ? "border-emerald-500/40 shadow-[0_0_25px_-12px] shadow-emerald-500/40" : "border-border"
            }`}
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="font-medium">Variante {i + 1}</span>
                {v.approved && (
                  <Badge className="bg-emerald-500/15 text-emerald-400">
                    <Check className="size-3" />
                    Aprobada
                  </Badge>
                )}
              </div>
              <Badge variant="outline">
                {v.generatedBy === "IA" ? "generado por IA" : "editado a mano"}
              </Badge>
            </div>

            <CampoCopy campo="primaryText" name="primaryText" defaultValue={v.primaryText} filas={4} />
            <CampoCopy campo="headline" name="headline" defaultValue={v.headline} filas={2} />
            <CampoCopy campo="description" name="description" defaultValue={v.description ?? ""} filas={2} />

            <div className="flex flex-wrap items-center gap-2 border-t border-border pt-3">
              <Button type="submit" name="accion" value="guardar" variant="outline" size="sm">
                <Save className="size-4" />
                Guardar
              </Button>
              <Button
                type="submit"
                name="accion"
                value="aprobar"
                size="sm"
                className="bg-emerald-500/15 text-emerald-400 hover:bg-emerald-500/25"
              >
                <Check className="size-4" />
                Guardar y aprobar
              </Button>
              <Button
                type="submit"
                name="accion"
                value="borrar"
                formNoValidate
                variant="ghost"
                size="sm"
                className="ml-auto text-destructive"
              >
                <Trash2 className="size-4" />
                Borrar
              </Button>
            </div>
          </form>
        ))}
      </div>
    </section>
  );
}
