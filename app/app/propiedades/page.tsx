import Link from "next/link";
import Image from "next/image";
import { redirect } from "next/navigation";
import { Home, Plus, ImageOff } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/session";
import { resolveOrganizationForUser } from "@/lib/org";
import { buttonVariants } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AppShell } from "@/app/components/app-shell";

const ESTADO: Record<string, { texto: string; variante: "default" | "secondary" | "outline" }> = {
  DISPONIBLE: { texto: "Disponible", variante: "default" },
  RESERVADA: { texto: "Reservada", variante: "secondary" },
  VENDIDA_ARRENDADA: { texto: "Vendida/Arrendada", variante: "outline" },
};

export default async function PropiedadesPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const organization = await resolveOrganizationForUser(user);
  if (!organization) redirect("/conectar");

  const propiedades = await prisma.property.findMany({
    where: { organizationId: organization.id },
    orderBy: { createdAt: "desc" },
    include: {
      media: { orderBy: { orden: "asc" }, take: 1 },
      _count: { select: { campaigns: true, media: true } },
    },
  });

  return (
    <AppShell
      titulo="Propiedades"
      descripcion={organization.name}
      usuario={user}
      activo="/propiedades"
      acciones={
        <Link href="/propiedades/nueva" className={buttonVariants({ size: "sm" })}>
          <Plus className="size-4" />
          Nueva propiedad
        </Link>
      }
    >
      {propiedades.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border p-10 text-center">
          <Home className="mx-auto mb-3 size-8 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">
            Todavía no hay propiedades. Carga la primera para poder crear campañas.
          </p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {propiedades.map((p) => {
            const estado = ESTADO[p.status] ?? { texto: p.status, variante: "outline" as const };
            const foto = p.media[0];
            return (
              <Link
                key={p.id}
                href={`/propiedades/${p.id}`}
                className="group overflow-hidden rounded-xl border border-border bg-card transition-colors hover:border-primary/40"
              >
                <div className="relative aspect-[4/3] bg-muted">
                  {foto ? (
                    <Image
                      src={foto.url}
                      alt=""
                      fill
                      sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                      className="object-cover transition-transform group-hover:scale-105"
                    />
                  ) : (
                    <div className="flex size-full flex-col items-center justify-center gap-2 text-muted-foreground">
                      <ImageOff className="size-6" />
                      <span className="text-xs">Sin fotos</span>
                    </div>
                  )}
                  <div className="absolute right-2 top-2">
                    <Badge variant={estado.variante}>{estado.texto}</Badge>
                  </div>
                </div>

                <div className="p-4">
                  <h3 className="truncate font-medium">{p.title}</h3>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {p.comuna ?? "Sin comuna"} · {p.propertyType.toLowerCase()}
                  </p>
                  <p className="mt-2 font-semibold">
                    {p.currency === "UF" ? "UF " : "$"}
                    {p.price.toLocaleString("es-CL")}
                  </p>
                  <p className="mt-2 text-xs text-muted-foreground">
                    {p._count.media} foto{p._count.media === 1 ? "" : "s"} · {p._count.campaigns}{" "}
                    campaña{p._count.campaigns === 1 ? "" : "s"}
                  </p>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </AppShell>
  );
}
