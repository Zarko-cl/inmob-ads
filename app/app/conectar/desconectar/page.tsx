import Link from "next/link";
import { redirect } from "next/navigation";
import { Unplug, AlertTriangle } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/session";
import { resolveOrganizationForUser } from "@/lib/org";
import { Button, buttonVariants } from "@/components/ui/button";

// Confirmación antes de desconectar. No se pide escribir ninguna palabra (como sí
// pasa al borrar una campaña) porque esto es reversible: se vuelve a conectar y listo.
// Lo que sí hace falta es dejar claro qué pasa con lo que ya está publicado.
export default async function DesconectarPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const organization = await resolveOrganizationForUser(user);
  if (!organization) redirect("/conectar");

  const conexion = await prisma.metaConnection.findFirst({
    where: { organizationId: organization.id, status: "ACTIVA" },
  });
  if (!conexion) redirect("/conectar");

  const enMeta = await prisma.campaign.count({
    where: { organizationId: organization.id, status: "EN_META" },
  });
  const activas = await prisma.campaign.count({
    where: { organizationId: organization.id, effectiveStatus: "ACTIVE" },
  });

  return (
    <div className="flex min-h-screen items-center justify-center px-6 py-12">
      <div className="w-full max-w-lg rounded-xl border border-border bg-card p-6">
        <div className="mb-4 flex items-center gap-2">
          <Unplug className="size-5 text-primary" />
          <h1 className="text-lg font-semibold">Desconectar la cuenta de Meta</h1>
        </div>

        <p className="text-sm text-muted-foreground">
          Vas a desconectar <strong className="text-foreground">{conexion.adAccountId}</strong>. La
          app deja de tener acceso a tu cuenta publicitaria.
        </p>

        <div className="mt-4 space-y-3 rounded-lg border border-border bg-background/40 p-4 text-sm">
          <p className="font-medium">Qué pasa exactamente</p>
          <ul className="space-y-2 text-muted-foreground">
            <li>
              <span className="text-foreground">Se borra el permiso, no tus anuncios.</span> Lo que
              ya está publicado sigue en Meta tal como está y lo puedes seguir viendo en Ads
              Manager.
            </li>
            <li>
              <span className="text-foreground">
                Desde acá no vas a poder publicar, pausar ni ver resultados
              </span>{" "}
              hasta que vuelvas a conectar.
            </li>
            <li>
              <span className="text-foreground">Al reconectar, Facebook te va a pedir permiso</span>{" "}
              otra vez, como la primera vez.
            </li>
          </ul>
        </div>

        {activas > 0 && (
          <div className="mt-4 flex gap-2 rounded-lg border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">
            <AlertTriangle className="mt-0.5 size-4 shrink-0" />
            <span>
              Tienes {activas} campaña(s) <strong>activas</strong>. Van a seguir mostrándose y
              gastando presupuesto, pero no vas a poder pausarlas desde acá. Si quieres detenerlas,
              hazlo antes de desconectar.
            </span>
          </div>
        )}

        {activas === 0 && enMeta > 0 && (
          <p className="mt-4 text-sm text-muted-foreground">
            Tienes {enMeta} campaña(s) en Meta, todas pausadas. No van a gastar nada mientras estés
            desconectado.
          </p>
        )}

        <div className="mt-6 flex flex-wrap gap-3">
          <form method="POST" action="/api/meta/desconectar">
            <Button type="submit" variant="destructive" className="h-10">
              <Unplug className="size-4" />
              Sí, desconectar
            </Button>
          </form>
          <Link href="/conectar" className={buttonVariants({ variant: "outline", className: "h-10" })}>
            Cancelar
          </Link>
        </div>
      </div>
    </div>
  );
}
