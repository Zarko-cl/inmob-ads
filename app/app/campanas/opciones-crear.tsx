import Link from "next/link";
import { ArrowRight, Layers, SlidersHorizontal, Wand2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";

// Una de las tres formas de crear, como tarjeta grande. La explicación no es adorno:
// "estrategia" y "campaña avanzada" no significan nada para alguien que nunca ha
// hecho publicidad, y sin el texto no puede elegir.
function OpcionCrear({
  href,
  icono,
  titulo,
  resumen,
  descripcion,
  detalle,
  destacada,
  recomendada,
}: {
  href: string;
  icono: React.ReactNode;
  titulo: string;
  resumen: string;
  descripcion: string;
  detalle: string;
  destacada?: boolean;
  recomendada?: string;
}) {
  return (
    <Link
      href={href}
      className={`group flex flex-col rounded-xl border p-5 transition-all ${
        destacada
          ? "border-primary/60 bg-primary/5 shadow-[0_0_40px_-16px] shadow-primary/60 hover:border-primary"
          : "border-border bg-card hover:border-primary/40"
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <span
          className={`flex size-10 items-center justify-center rounded-lg ${
            destacada ? "bg-primary text-primary-foreground" : "bg-muted text-primary"
          }`}
        >
          {icono}
        </span>
        {recomendada && <Badge>{recomendada}</Badge>}
      </div>

      <h3 className="mt-4 text-base font-medium">{titulo}</h3>
      <p className="text-sm text-primary">{resumen}</p>
      <p className="mt-2 flex-1 text-sm text-muted-foreground">{descripcion}</p>

      <div className="mt-4 flex items-center justify-between gap-2 border-t border-border pt-3">
        <span className="text-xs text-muted-foreground">{detalle}</span>
        <ArrowRight className="size-4 text-primary transition-transform group-hover:translate-x-0.5" />
      </div>
    </Link>
  );
}

// Las tres formas de crear. Cada una dice qué hace y para quién es: sin eso, alguien
// que nunca ha hecho publicidad no tiene cómo elegir entre ellas.
export function OpcionesCrear() {
  return (
      <section>
        <h2 className="text-lg font-medium">¿Qué quieres hacer?</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Si es tu primera vez, la opción de la izquierda es la que buscas.
        </p>
        <div className="mt-4 grid gap-4 lg:grid-cols-3">
          <OpcionCrear
            href="/crear-anuncio"
            destacada
            icono={<Wand2 className="size-5" />}
            titulo="Crear un anuncio"
            resumen="Lo más simple y rápido"
            descripcion="Subes las fotos de una propiedad y respondes cinco preguntas. Nosotros escribimos el texto y decidimos a quién mostrárselo."
            detalle="Un anuncio para una propiedad"
            recomendada="Recomendado"
          />
          <OpcionCrear
            href="/estrategias/nueva"
            icono={<Layers className="size-5" />}
            titulo="Crear una estrategia"
            resumen="Varios anuncios a la vez"
            descripcion="Dices cuánto quieres invertir al mes y la app arma varias campañas para la misma propiedad, probando distintos públicos y textos entre sí."
            detalle="Hasta 4 campañas · desde $28.000 al mes"
          />
          <OpcionCrear
            href="/campanas/nueva"
            icono={<SlidersHorizontal className="size-5" />}
            titulo="Campaña avanzada"
            resumen="Tú controlas todo"
            descripcion="Eliges el objetivo, la segmentación por comuna, edad e intereses, el formato y cada texto a mano."
            detalle="Para quien ya sabe de Meta Ads"
          />
        </div>
      </section>
  );
}
