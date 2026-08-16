import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { getCurrentUser } from "@/lib/session";
import { resolveOrganizationForUser } from "@/lib/org";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { AppShell } from "@/app/components/app-shell";

// Los <select> nativos se estilan a mano: el Select de shadcn es un componente
// cliente y estos formularios se envían con POST tradicional, sin JavaScript.
const claseSelect =
  "h-9 w-full rounded-lg border border-border bg-input/30 px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50";

export default async function NuevaPropiedadPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const organization = await resolveOrganizationForUser(user);
  if (!organization) redirect("/conectar");

  return (
    <AppShell
      titulo="Nueva propiedad"
      descripcion="Los datos alimentan los anuncios, los textos y los reportes."
      usuario={user}
      activo="/propiedades"
      acciones={
        <Link href="/propiedades" className={buttonVariants({ variant: "outline", size: "sm" })}>
          <ArrowLeft className="size-4" />
          Volver
        </Link>
      }
    >
      <form method="POST" action="/api/propiedades" className="max-w-2xl space-y-6">
        <div className="space-y-4 rounded-xl border border-border bg-card p-6">
          <div className="space-y-2">
            <Label htmlFor="title">Título *</Label>
            <Input id="title" name="title" required placeholder="Ej: Depto 2D/2B en Providencia" />
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="price">Precio *</Label>
              <Input id="price" type="number" name="price" required min={0} step="0.01" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="currency">Moneda</Label>
              <select id="currency" name="currency" className={claseSelect}>
                <option value="CLP">CLP</option>
                <option value="UF">UF</option>
              </select>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="propertyType">Tipo</Label>
              <select id="propertyType" name="propertyType" className={claseSelect}>
                <option value="DEPARTAMENTO">Departamento</option>
                <option value="CASA">Casa</option>
                <option value="OFICINA">Oficina</option>
                <option value="TERRENO">Terreno</option>
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="operation">Operación</Label>
              <select id="operation" name="operation" className={claseSelect}>
                <option value="VENTA">Venta</option>
                <option value="ARRIENDO">Arriendo</option>
              </select>
            </div>
          </div>
        </div>

        <details className="rounded-xl border border-border bg-card">
          <summary className="cursor-pointer px-6 py-4 font-medium">
            Datos adicionales (opcional)
            <p className="mt-1 text-sm font-normal text-muted-foreground">
              No hacen falta para crear campañas, pero mejoran mucho el texto que genera la IA y
              definen a dónde llega el contacto.
            </p>
          </summary>

          <div className="space-y-4 border-t border-border p-6">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="comuna">Comuna</Label>
                <Input id="comuna" name="comuna" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="region">Región</Label>
                <Input id="region" name="region" defaultValue="Metropolitana" />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="address">Dirección</Label>
              <Input id="address" name="address" />
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              <div className="space-y-2">
                <Label htmlFor="surfaceM2">Superficie (m²)</Label>
                <Input id="surfaceM2" type="number" name="surfaceM2" min={0} step="0.1" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="bedrooms">Dormitorios</Label>
                <Input id="bedrooms" type="number" name="bedrooms" min={0} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="bathrooms">Baños</Label>
                <Input id="bathrooms" type="number" name="bathrooms" min={0} />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Descripción</Label>
              <Textarea id="description" name="description" rows={3} />
            </div>

            <fieldset className="space-y-3 rounded-lg border border-border p-4">
              <legend className="px-1 text-sm font-medium">Asesor a cargo</legend>
              <Input name="agentName" placeholder="Nombre" />
              <Input type="email" name="agentEmail" placeholder="Email" />
              <Input type="tel" name="agentPhone" placeholder="Teléfono" />
            </fieldset>
          </div>
        </details>

        <Button type="submit" className="h-10">
          Guardar propiedad
        </Button>
      </form>
    </AppShell>
  );
}
