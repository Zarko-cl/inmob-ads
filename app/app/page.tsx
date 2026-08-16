import Link from "next/link";
import {
  ArrowRight,
  Building2,
  Sparkles,
  Target,
  ShieldCheck,
  BarChart3,
  Layers,
} from "lucide-react";
import { buttonVariants } from "@/components/ui/button";

// Landing pública del producto. Es la primera pantalla que ve alguien que llega
// sin sesión: explica qué hace la app y lleva a iniciar sesión.

const CARACTERISTICAS = [
  {
    icono: Building2,
    titulo: "Catálogo de propiedades",
    texto:
      "Carga cada propiedad una vez con sus fotos, precio y ubicación. De ahí salen los anuncios, los textos y los reportes.",
  },
  {
    icono: Sparkles,
    titulo: "Copys escritos con IA",
    texto:
      "Genera variantes del texto del anuncio a partir de los datos reales de la propiedad, respetando los límites de Meta.",
  },
  {
    icono: Target,
    titulo: "Segmentación por comuna",
    texto:
      "Apunta a Providencia, Las Condes o la comuna que quieras, con rangos de edad que no compiten entre sí.",
  },
  {
    icono: Layers,
    titulo: "Estrategias automáticas",
    texto:
      "Define un presupuesto mensual y la app arma la estructura completa de campañas, conjuntos y anuncios.",
  },
  {
    icono: ShieldCheck,
    titulo: "Revisión normativa",
    texto:
      "Antes de publicar revisa las normas de Meta y la Ley del Consumidor: nada de plusvalía garantizada ni precios que no calzan.",
  },
  {
    icono: BarChart3,
    titulo: "Resultados por propiedad",
    texto:
      "Cuánto se invirtió y cuántos contactos generó cada propiedad. Algo que el administrador de Meta no puede mostrarte.",
  },
];

const PASOS = [
  { n: "01", titulo: "Conecta tu cuenta", texto: "Vinculas tu cuenta publicitaria de Meta con un clic, sin compartir contraseñas." },
  { n: "02", titulo: "Carga la propiedad", texto: "Fotos, precio, comuna y características. Una sola vez." },
  { n: "03", titulo: "Arma la campaña", texto: "Eliges destino, presupuesto y segmentación. Los textos los escribe la IA." },
  { n: "04", titulo: "Publica y mide", texto: "Todo sale pausado hasta que tú confirmes. Después ves los resultados por propiedad." },
];

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Barra superior */}
      <header className="fixed top-0 z-50 w-full border-b border-border/50 bg-background/80 backdrop-blur-md">
        <nav className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <Link href="/" className="flex items-center gap-2 text-lg font-semibold">
            <Building2 className="size-5 text-primary" />
            Inmob Ads
          </Link>

          <div className="absolute left-1/2 top-1/2 hidden -translate-x-1/2 -translate-y-1/2 items-center gap-8 md:flex">
            <a href="#producto" className="text-sm text-muted-foreground transition-colors hover:text-foreground">
              Producto
            </a>
            <a href="#como-funciona" className="text-sm text-muted-foreground transition-colors hover:text-foreground">
              Cómo funciona
            </a>
          </div>

          <Link href="/login" className={buttonVariants({ size: "sm" })}>
            Iniciar sesión
          </Link>
        </nav>
      </header>

      {/* Hero */}
      <section className="relative flex flex-col items-center overflow-hidden px-6 pb-24 pt-32 md:pt-40">
        {/* Fondo: cuadrícula técnica + dos resplandores que laten. Todo CSS, sin
            imágenes externas. */}
        <div aria-hidden className="fondo-cuadricula pointer-events-none absolute inset-0 -z-20" />
        <div
          aria-hidden
          className="animar-latido pointer-events-none absolute -z-10 h-[520px] w-[720px] rounded-full blur-3xl"
          style={{
            top: "-140px",
            background: "radial-gradient(circle, oklch(0.62 0.21 285 / 0.35) 0%, transparent 70%)",
          }}
        />
        <div
          aria-hidden
          className="animar-latido pointer-events-none absolute -z-10 h-[420px] w-[520px] rounded-full blur-3xl"
          style={{
            top: "120px",
            right: "-80px",
            animationDelay: "2s",
            background: "radial-gradient(circle, oklch(0.70 0.16 200 / 0.25) 0%, transparent 70%)",
          }}
        />

        <div className="animar-aparecer mb-8 inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/5 px-4 py-2 backdrop-blur-sm">
          <span className="relative flex size-2">
            <span className="absolute inline-flex size-full animate-ping rounded-full bg-primary opacity-75" />
            <span className="relative inline-flex size-2 rounded-full bg-primary" />
          </span>
          <span className="text-xs text-muted-foreground">Hecho para el mercado chileno</span>
          <a href="#producto" className="inline-flex items-center gap-1 text-xs transition-colors hover:text-foreground">
            Ver más
            <ArrowRight className="size-3" />
          </a>
        </div>

        <h1 className="texto-degradado animar-aparecer retraso-1 max-w-3xl text-center text-4xl font-medium leading-tight tracking-tight md:text-5xl lg:text-6xl">
          Publica tus propiedades
          <br />
          sin pelear con Meta Ads
        </h1>

        <p className="animar-aparecer retraso-2 mt-6 max-w-2xl text-center text-muted-foreground md:text-lg">
          Conecta tu cuenta publicitaria, carga una propiedad y la app arma la campaña completa:
          segmentación, textos e imágenes. Todo listo para que la revises antes de gastar un peso.
        </p>

        <div className="animar-aparecer retraso-3 mt-10 flex flex-wrap items-center justify-center gap-4">
          <Link href="/login" className={buttonVariants({ size: "lg", className: "h-12 px-6 text-base" })}>
            Entrar a la plataforma
            <ArrowRight className="size-4" />
          </Link>
          <a
            href="#como-funciona"
            className={buttonVariants({ variant: "outline", size: "lg", className: "h-12 px-6 text-base" })}
          >
            Cómo funciona
          </a>
        </div>

        {/* Vista previa del panel real, dibujada en HTML (no es una captura externa) */}
        <div className="animar-aparecer retraso-4 animar-flotar relative mt-20 w-full max-w-5xl">
          <div className="overflow-hidden rounded-xl border border-primary/20 bg-card shadow-[0_0_60px_-15px] shadow-primary/30">
            <div className="barrido relative flex items-center gap-2 overflow-hidden border-b border-border bg-muted/30 px-4 py-3">
              <div className="flex gap-1.5">
                <span className="size-3 rounded-full bg-red-500/70" />
                <span className="size-3 rounded-full bg-yellow-500/70" />
                <span className="size-3 rounded-full bg-green-500/70" />
              </div>
              <span className="ml-2 text-xs text-muted-foreground">Reportes — Viviendaonline</span>
            </div>

            <div className="grid gap-4 p-6 sm:grid-cols-2 lg:grid-cols-4">
              {[
                { etiqueta: "Personas alcanzadas", valor: "48.320" },
                { etiqueta: "Contactos", valor: "127" },
                { etiqueta: "Invertido", valor: "$420.000" },
                { etiqueta: "Costo por contacto", valor: "$3.307" },
              ].map((k) => (
                <div key={k.etiqueta} className="rounded-lg border border-border bg-background/50 p-4">
                  <div className="text-xs text-muted-foreground">{k.etiqueta}</div>
                  <div className="mt-1 bg-gradient-to-br from-foreground to-primary bg-clip-text text-2xl font-semibold text-transparent">
                    {k.valor}
                  </div>
                </div>
              ))}
            </div>

            <div className="space-y-3 px-6 pb-6">
              {[
                { nombre: "Casa en Til Til", barra: "78%", contactos: "64 contactos" },
                { nombre: "Depto 2D/2B Providencia", barra: "52%", contactos: "41 contactos" },
                { nombre: "Oficina Las Condes", barra: "26%", contactos: "22 contactos" },
              ].map((p) => (
                <div key={p.nombre} className="rounded-lg border border-border bg-background/50 p-4">
                  <div className="mb-2 flex items-center justify-between text-sm">
                    <span className="font-medium">{p.nombre}</span>
                    <span className="text-muted-foreground">{p.contactos}</span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-primary to-chart-2"
                      style={{ width: p.barra }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
          <p className="mt-3 text-center text-xs text-muted-foreground">
            Ejemplo ilustrativo de la pantalla de reportes.
          </p>
        </div>
      </section>

      {/* Características */}
      <section id="producto" className="mx-auto max-w-7xl px-6 py-24">
        <h2 className="text-center text-3xl font-medium tracking-tight md:text-4xl">
          Todo el proceso en un solo lugar
        </h2>
        <p className="mx-auto mt-4 max-w-2xl text-center text-muted-foreground">
          Desde la ficha de la propiedad hasta el reporte que le muestras al dueño.
        </p>

        <div className="mt-16 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {CARACTERISTICAS.map((c) => (
            <div
              key={c.titulo}
              className="tarjeta-glow rounded-xl border border-border bg-card p-6"
            >
              <div className="mb-4 flex size-10 items-center justify-center rounded-lg bg-gradient-to-br from-primary/25 to-chart-2/20 ring-1 ring-primary/20">
                <c.icono className="size-5 text-primary" />
              </div>
              <h3 className="mb-2 font-medium">{c.titulo}</h3>
              <p className="text-sm leading-relaxed text-muted-foreground">{c.texto}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Cómo funciona */}
      <section id="como-funciona" className="border-y border-border bg-card/30">
        <div className="mx-auto max-w-7xl px-6 py-24">
          <h2 className="text-center text-3xl font-medium tracking-tight md:text-4xl">Cómo funciona</h2>

          <div className="mt-16 grid gap-8 md:grid-cols-2 lg:grid-cols-4">
            {PASOS.map((p) => (
              <div key={p.n}>
                <div className="mb-3 inline-flex size-9 items-center justify-center rounded-lg bg-gradient-to-br from-primary/25 to-chart-2/20 text-sm font-semibold text-primary ring-1 ring-primary/20">
                  {p.n}
                </div>
                <h3 className="mb-2 font-medium">{p.titulo}</h3>
                <p className="text-sm leading-relaxed text-muted-foreground">{p.texto}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Cierre */}
      <section className="relative mx-auto max-w-3xl overflow-hidden px-6 py-24 text-center">
        <div
          aria-hidden
          className="animar-latido pointer-events-none absolute left-1/2 top-1/2 -z-10 h-[300px] w-[600px] -translate-x-1/2 -translate-y-1/2 rounded-full blur-3xl"
          style={{ background: "radial-gradient(circle, oklch(0.62 0.21 285 / 0.20) 0%, transparent 70%)" }}
        />
        <h2 className="text-3xl font-medium tracking-tight md:text-4xl">
          Tus campañas nunca se publican solas
        </h2>
        <p className="mx-auto mt-4 max-w-xl text-muted-foreground">
          Cada campaña se crea pausada. Para activarla y empezar a gastar, la app te muestra antes
          cuánto costará por día y por mes, y te pide confirmarlo.
        </p>
        <Link
          href="/login"
          className={buttonVariants({ size: "lg", className: "mt-8 h-12 px-6 text-base" })}
        >
          Entrar a la plataforma
          <ArrowRight className="size-4" />
        </Link>
      </section>

      <footer className="border-t border-border">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-4 px-6 py-8 text-sm text-muted-foreground sm:flex-row">
          <div className="flex items-center gap-2">
            <Building2 className="size-4" />
            Inmob Ads
          </div>
          <span>El gasto publicitario se cobra directamente en tu cuenta de Meta.</span>
        </div>
      </footer>
    </div>
  );
}
