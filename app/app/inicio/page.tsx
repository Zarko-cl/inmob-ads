import Link from "next/link";
import { redirect } from "next/navigation";
import { Check, ArrowRight, Sparkles, ShieldCheck, Wallet } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/session";
import { resolveOrganizationForUser } from "@/lib/org";
import { PASOS, estadoDePasos, esPrimeraVez, type AvanceUsuario } from "@/lib/pasos";
import { buttonVariants } from "@/components/ui/button";
import { AppShell } from "@/app/components/app-shell";

// Pantalla de inicio: la guía paso a paso.
//
// No es un tutorial que se ve una vez y desaparece. Es una página a la que se puede
// volver siempre, que además marca lo que ya está hecho — así sirve de bienvenida el
// primer día y de "¿en qué iba?" después.
export default async function InicioPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const organization = await resolveOrganizationForUser(user);
  if (!organization) redirect("/conectar");

  // Una consulta por señal, todas en paralelo. Solo se necesita saber si existe al
  // menos uno de cada cosa, así que se cuenta en vez de traer las filas.
  const [conexiones, propiedadesConFotos, campanas, enMeta, activas] = await Promise.all([
    prisma.metaConnection.count({ where: { organizationId: organization.id, status: "ACTIVA" } }),
    prisma.property.count({ where: { organizationId: organization.id, media: { some: {} } } }),
    prisma.campaign.count({ where: { organizationId: organization.id } }),
    prisma.campaign.count({ where: { organizationId: organization.id, status: "EN_META" } }),
    prisma.campaign.count({ where: { organizationId: organization.id, effectiveStatus: "ACTIVE" } }),
  ]);

  const avance: AvanceUsuario = {
    tieneConexion: conexiones > 0,
    tienePropiedadConFotos: propiedadesConFotos > 0,
    tieneCampana: campanas > 0,
    tieneCampanaEnMeta: enMeta > 0,
    tieneCampanaActiva: activas > 0,
  };
  const estados = estadoDePasos(avance);
  const primeraVez = esPrimeraVez(avance);
  const pasoActual = PASOS.find((p) => estados[p.numero] === "ACTUAL");

  return (
    <AppShell
      titulo={primeraVez ? `Bienvenido, ${user.email.split("@")[0]}` : "Inicio"}
      descripcion={
        primeraVez
          ? "Vamos a publicar tu primer anuncio. Son siete pasos y te acompañamos en todos."
          : organization.name
      }
      usuario={user}
      activo="/inicio"
    >
      <div className="max-w-3xl space-y-6">
        {/* Las tres cosas que más tranquilizan a alguien que nunca ha hecho esto */}
        {primeraVez && (
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-xl border border-border bg-card p-4">
              <Sparkles className="size-4 text-primary" />
              <p className="mt-2 text-sm font-medium">No tienes que saber de publicidad</p>
              <p className="mt-1 text-xs text-muted-foreground">
                La app escribe el texto y decide a quién mostrarle el anuncio.
              </p>
            </div>
            <div className="rounded-xl border border-border bg-card p-4">
              <Wallet className="size-4 text-primary" />
              <p className="mt-2 text-sm font-medium">No se gasta nada sin que tú lo digas</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Todo queda pausado hasta que aprietes “Activar”, y lo puedes detener cuando quieras.
              </p>
            </div>
            <div className="rounded-xl border border-border bg-card p-4">
              <ShieldCheck className="size-4 text-primary" />
              <p className="mt-2 text-sm font-medium">Revisamos que cumpla las reglas</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Antes de publicar, la app chequea las normas de Meta y la ley chilena.
              </p>
            </div>
          </div>
        )}

        {/* Lo único que hay que hacer ahora */}
        {pasoActual && (
          <div className="rounded-xl border border-primary/50 bg-primary/5 p-5">
            <p className="text-xs uppercase tracking-wide text-primary">
              {primeraVez ? "Empieza por acá" : "Lo que sigue"}
            </p>
            <h2 className="mt-1 text-lg font-medium">
              Paso {pasoActual.numero}: {pasoActual.titulo}
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">{pasoActual.quehacer}</p>
            <Link href={pasoActual.href} className={buttonVariants({ className: "mt-4 h-10" })}>
              {pasoActual.textoBoton}
              <ArrowRight className="size-4" />
            </Link>
          </div>
        )}

        {!pasoActual && (
          <div className="rounded-xl border border-emerald-500/40 bg-emerald-500/5 p-5">
            <h2 className="text-lg font-medium text-emerald-400">Tienes anuncios activos</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Ya completaste todo el recorrido. Revisa cómo van tus anuncios en Reportes.
            </p>
            <Link
              href="/reportes"
              className={buttonVariants({ variant: "outline", className: "mt-4 h-10" })}
            >
              Ver resultados
              <ArrowRight className="size-4" />
            </Link>
          </div>
        )}

        {/* El recorrido completo */}
        <section>
          <h2 className="mb-3 text-sm font-medium text-muted-foreground">
            Cómo funciona, de principio a fin
          </h2>
          <ol className="space-y-2">
            {PASOS.map((paso) => {
              const estado = estados[paso.numero];
              return (
                <li
                  key={paso.numero}
                  className={`rounded-xl border p-4 transition-colors ${
                    estado === "ACTUAL"
                      ? "border-primary/50 bg-card"
                      : estado === "HECHO"
                        ? "border-border bg-card/50"
                        : "border-border bg-card/30"
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <span
                      className={`mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${
                        estado === "HECHO"
                          ? "bg-emerald-500/20 text-emerald-400"
                          : estado === "ACTUAL"
                            ? "bg-primary text-primary-foreground"
                            : "bg-muted text-muted-foreground"
                      }`}
                    >
                      {estado === "HECHO" ? <Check className="size-3.5" /> : paso.numero}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3
                          className={`font-medium ${estado === "PENDIENTE" ? "text-muted-foreground" : ""}`}
                        >
                          {paso.titulo}
                        </h3>
                        {estado === "HECHO" && (
                          <span className="text-xs text-emerald-400">Listo</span>
                        )}
                      </div>
                      <p className="mt-1 text-sm text-muted-foreground">{paso.quehacer}</p>
                      <p className="mt-1 text-xs text-muted-foreground/80">{paso.porque}</p>
                      {estado !== "PENDIENTE" && (
                        <Link
                          href={paso.href}
                          className="mt-2 inline-flex items-center gap-1 text-sm text-primary underline-offset-4 hover:underline"
                        >
                          {paso.textoBoton}
                          <ArrowRight className="size-3.5" />
                        </Link>
                      )}
                    </div>
                  </div>
                </li>
              );
            })}
          </ol>
        </section>
      </div>
    </AppShell>
  );
}
