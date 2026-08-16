import Link from "next/link";
import { redirect } from "next/navigation";
import { SlidersHorizontal } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/session";
import { resolveOrganizationForUser } from "@/lib/org";
import { buttonVariants } from "@/components/ui/button";
import { AppShell, Aviso } from "@/app/components/app-shell";
import { Asistente } from "./asistente";

// Modo simple (vista "Fácil"): crear un anuncio completo respondiendo cinco cosas.
// La vista equivalente para quien sí sabe de anuncios es /campanas/nueva.
export default async function CrearAnuncioPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const organization = await resolveOrganizationForUser(user);
  if (!organization) redirect("/conectar");

  const conexion = await prisma.metaConnection.findFirst({
    where: { organizationId: organization.id, status: "ACTIVA" },
  });

  const propiedades = await prisma.property.findMany({
    where: { organizationId: organization.id, status: "DISPONIBLE" },
    orderBy: { createdAt: "desc" },
    include: { media: { orderBy: { orden: "asc" } } },
  });

  return (
    <AppShell
      titulo="Crear un anuncio"
      descripcion="Modo fácil — respondes cinco cosas y nosotros armamos el resto"
      usuario={user}
      activo="/campanas"
      acciones={
        <Link
          href="/campanas/nueva"
          className={buttonVariants({ variant: "outline", size: "sm" })}
        >
          <SlidersHorizontal className="size-4" />
          Modo avanzado
        </Link>
      }
    >
      {!conexion ? (
        <div className="max-w-2xl">
          <Aviso tono="error">
            Antes de crear anuncios tienes que conectar tu cuenta de Meta.{" "}
            <Link href="/conectar" className="underline underline-offset-4">
              Conectar ahora
            </Link>
          </Aviso>
        </div>
      ) : (
        <Asistente
          propiedades={propiedades.map((p) => ({
            id: p.id,
            title: p.title,
            media: p.media.map((m) => ({ id: m.id, url: m.url })),
          }))}
        />
      )}
    </AppShell>
  );
}
