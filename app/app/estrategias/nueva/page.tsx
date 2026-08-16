import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { AppShell } from "@/app/components/app-shell";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/session";
import { resolveOrganizationForUser } from "@/lib/org";
import { getActiveMetaConnection } from "@/lib/meta-connection";
import { CAMPAIGN_TYPES, validarRequisitos, type CampaignTypeKey } from "@/lib/meta-campaign-types";
import { FormularioEstrategia } from "./formulario";

export default async function NuevaEstrategiaPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const organization = await resolveOrganizationForUser(user);
  if (!organization) redirect("/conectar");

  const propiedades = await prisma.property.findMany({
    where: { organizationId: organization.id, status: "DISPONIBLE" },
    orderBy: { title: "asc" },
    select: { id: true, title: true, media: { select: { id: true } } },
  });

  const connection = await getActiveMetaConnection(organization.id);
  if (!connection) {
    return (
      <AppShell titulo="Nueva estrategia" usuario={user} activo="/campanas">
        <p className="text-sm text-muted-foreground">
          Esta organización todavía no tiene una cuenta de Meta conectada.{" "}
          <Link href="/conectar" className="underline underline-offset-4">
            Conectar ahora →
          </Link>
        </p>
      </AppShell>
    );
  }

  const faltantesPorTipo: Record<string, string[]> = {};
  for (const key of Object.keys(CAMPAIGN_TYPES) as CampaignTypeKey[]) {
    faltantesPorTipo[key] = validarRequisitos(key, {
      destinationUrl: "placeholder",
      pageId: connection.pageId,
      whatsappBusinessAccountId: connection.whatsappBusinessAccountId,
      instagramActorId: connection.instagramActorId,
    });
  }

  return (
    <AppShell
      titulo="Nueva estrategia"
      descripcion="Genera varias campañas de una vez, dimensionadas según el presupuesto mensual."
      usuario={user}
      activo="/campanas"
      acciones={
        <Link href="/campanas" className={buttonVariants({ variant: "outline", size: "sm" })}>
          <ArrowLeft className="size-4" />
          Volver
        </Link>
      }
    >
      <FormularioEstrategia propiedades={propiedades} faltantesPorTipo={faltantesPorTipo} />
    </AppShell>
  );
}
