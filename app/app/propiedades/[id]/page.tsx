import Link from "next/link";
import { redirect, notFound } from "next/navigation";
import { ArrowLeft, AlertTriangle } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/session";
import { resolveOrganizationForUser } from "@/lib/org";
import { storageConfigurado } from "@/lib/storage";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { AppShell, Aviso } from "@/app/components/app-shell";
import { FotosPanel } from "./fotos-panel";
import { usoDeFotos } from "@/lib/fotos";

const claseSelect =
  "h-9 w-full rounded-lg border border-border bg-input/30 px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50";

export default async function PropiedadDetallePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const organization = await resolveOrganizationForUser(user);
  if (!organization) redirect("/conectar");

  const { id } = await params;
  const property = await prisma.property.findFirst({
    where: { id, organizationId: organization.id },
    include: { campaigns: true, media: { orderBy: { orden: "asc" } } },
  });
  if (!property) notFound();

  // Dónde se está usando cada foto, para avisar antes de borrarla.
  const usoFotos = await usoDeFotos(property.id);

  const campanasActivas = property.campaigns.filter((c) => c.status === "EN_META");
  const mostrarSugerenciaPausa = property.status !== "DISPONIBLE" && campanasActivas.length > 0;

  // La sección opcional se abre sola si ya hay datos, para que no queden escondidos.
  const tieneDatosAdicionales = Boolean(
    property.comuna ||
      property.region ||
      property.address ||
      property.surfaceM2 ||
      property.bedrooms ||
      property.bathrooms ||
      property.description ||
      property.agentName ||
      property.agentEmail ||
      property.agentPhone
  );

  return (
    <AppShell
      titulo={property.title}
      descripcion={`${property.propertyType.toLowerCase()} · ${property.comuna ?? "sin comuna"}`}
      usuario={user}
      activo="/propiedades"
      acciones={
        <Link href="/propiedades" className={buttonVariants({ variant: "outline", size: "sm" })}>
          <ArrowLeft className="size-4" />
          Volver
        </Link>
      }
    >
      <div className="max-w-2xl space-y-6">
        {mostrarSugerenciaPausa && (
          <Aviso tono="aviso">
            <div className="flex gap-2">
              <AlertTriangle className="mt-0.5 size-4 shrink-0" />
              <div>
                Esta propiedad está marcada como{" "}
                <strong>
                  {property.status === "RESERVADA" ? "Reservada" : "Vendida/Arrendada"}
                </strong>{" "}
                pero tiene {campanasActivas.length} campaña(s) en Meta:{" "}
                {campanasActivas.map((c, i) => (
                  <span key={c.id}>
                    {i > 0 && ", "}
                    <Link href={`/campanas/${c.id}`} className="underline underline-offset-4">
                      {c.name}
                    </Link>
                  </span>
                ))}
                . Considera pausarlas.
              </div>
            </div>
          </Aviso>
        )}

        <form
          method="POST"
          action={`/api/propiedades/${property.id}`}
          className="space-y-6"
        >
          <div className="space-y-4 rounded-xl border border-border bg-card p-6">
            <div className="space-y-2">
              <Label htmlFor="title">Título *</Label>
              <Input id="title" name="title" defaultValue={property.title} required />
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="price">Precio *</Label>
                <Input
                  id="price"
                  type="number"
                  name="price"
                  defaultValue={property.price}
                  required
                  min={0}
                  step="0.01"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="currency">Moneda</Label>
                <select id="currency" name="currency" defaultValue={property.currency} className={claseSelect}>
                  <option value="CLP">CLP</option>
                  <option value="UF">UF</option>
                </select>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              <div className="space-y-2">
                <Label htmlFor="propertyType">Tipo</Label>
                <select
                  id="propertyType"
                  name="propertyType"
                  defaultValue={property.propertyType}
                  className={claseSelect}
                >
                  <option value="DEPARTAMENTO">Departamento</option>
                  <option value="CASA">Casa</option>
                  <option value="OFICINA">Oficina</option>
                  <option value="TERRENO">Terreno</option>
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="operation">Operación</Label>
                <select
                  id="operation"
                  name="operation"
                  defaultValue={property.operation}
                  className={claseSelect}
                >
                  <option value="VENTA">Venta</option>
                  <option value="ARRIENDO">Arriendo</option>
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="status">Estado</Label>
                <select id="status" name="status" defaultValue={property.status} className={claseSelect}>
                  <option value="DISPONIBLE">Disponible</option>
                  <option value="RESERVADA">Reservada</option>
                  <option value="VENDIDA_ARRENDADA">Vendida/Arrendada</option>
                </select>
              </div>
            </div>
          </div>

          <details open={tieneDatosAdicionales} className="rounded-xl border border-border bg-card">
            <summary className="cursor-pointer px-6 py-4 font-medium">
              Datos adicionales (opcional)
              <p className="mt-1 text-sm font-normal text-muted-foreground">
                Mejoran el texto que genera la IA y definen a dónde llega el contacto.
              </p>
            </summary>

            <div className="space-y-4 border-t border-border p-6">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="comuna">Comuna</Label>
                  <Input id="comuna" name="comuna" defaultValue={property.comuna ?? ""} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="region">Región</Label>
                  <Input id="region" name="region" defaultValue={property.region ?? ""} />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="address">Dirección</Label>
                <Input id="address" name="address" defaultValue={property.address ?? ""} />
              </div>

              <div className="grid gap-4 sm:grid-cols-3">
                <div className="space-y-2">
                  <Label htmlFor="surfaceM2">Superficie (m²)</Label>
                  <Input
                    id="surfaceM2"
                    type="number"
                    name="surfaceM2"
                    defaultValue={property.surfaceM2 ?? ""}
                    min={0}
                    step="0.1"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="bedrooms">Dormitorios</Label>
                  <Input
                    id="bedrooms"
                    type="number"
                    name="bedrooms"
                    defaultValue={property.bedrooms ?? ""}
                    min={0}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="bathrooms">Baños</Label>
                  <Input
                    id="bathrooms"
                    type="number"
                    name="bathrooms"
                    defaultValue={property.bathrooms ?? ""}
                    min={0}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Descripción</Label>
                <Textarea
                  id="description"
                  name="description"
                  rows={3}
                  defaultValue={property.description ?? ""}
                />
              </div>

              <fieldset className="space-y-3 rounded-lg border border-border p-4">
                <legend className="px-1 text-sm font-medium">Asesor a cargo</legend>
                <Input name="agentName" defaultValue={property.agentName ?? ""} placeholder="Nombre" />
                <Input
                  type="email"
                  name="agentEmail"
                  defaultValue={property.agentEmail ?? ""}
                  placeholder="Email"
                />
                <Input
                  type="tel"
                  name="agentPhone"
                  defaultValue={property.agentPhone ?? ""}
                  placeholder="Teléfono"
                />
              </fieldset>
            </div>
          </details>

          <Button type="submit" className="h-10">
            Guardar cambios
          </Button>
        </form>

        <div className="rounded-xl border border-border bg-card p-6">
          <FotosPanel
            propertyId={property.id}
            fotos={property.media}
            uso={usoFotos}
            storageConfigurado={storageConfigurado()}
          />
        </div>

        <section>
          <h2 className="mb-3 text-sm font-medium text-muted-foreground">
            Campañas de esta propiedad
          </h2>
          {property.campaigns.length === 0 ? (
            <p className="text-sm text-muted-foreground">Ninguna todavía.</p>
          ) : (
            <div className="grid gap-2">
              {property.campaigns.map((c) => (
                <Link
                  key={c.id}
                  href={`/campanas/${c.id}`}
                  className="flex items-center justify-between rounded-lg border border-border bg-card px-4 py-3 text-sm transition-colors hover:border-primary/40"
                >
                  <span>{c.name}</span>
                  <Badge variant="outline">{c.status}</Badge>
                </Link>
              ))}
            </div>
          )}
        </section>
      </div>
    </AppShell>
  );
}
