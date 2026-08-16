import Link from "next/link";
import { redirect } from "next/navigation";
import { ShieldCheck, ShieldAlert, Trash2, UserPlus, Plus } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/session";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { AppShell } from "@/app/components/app-shell";

const ROLES = ["ADMIN_INMOBILIARIA", "EDITOR", "SOLO_LECTURA"] as const;

const claseSelect =
  "h-9 w-full rounded-lg border border-border bg-input/30 px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50";

export default async function OrganizacionesPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  if (user.role !== "ADMIN_AGENCIA") {
    return (
      <AppShell titulo="Administración" usuario={user} activo="/admin/organizaciones">
        <p className="text-sm text-muted-foreground">
          No tienes permiso para ver esta página (se requiere rol de administrador de agencia).
        </p>
      </AppShell>
    );
  }

  const organizaciones = await prisma.organization.findMany({
    include: { users: true },
    orderBy: { createdAt: "desc" },
  });

  return (
    <AppShell
      titulo="Inmobiliarias"
      descripcion="Alta de clientes, usuarios y datos de cumplimiento."
      usuario={user}
      activo="/admin/organizaciones"
    >
      <div className="max-w-3xl space-y-6">
        <div className="grid gap-4">
          {organizaciones.map((org) => (
            <div key={org.id} className="rounded-xl border border-border bg-card p-5">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <h2 className="font-medium">{org.name}</h2>
                  <p className="mt-0.5 text-sm text-muted-foreground">
                    {org.rut ?? "sin RUT"} · {org.status} · {org.users.length} usuario(s)
                  </p>
                </div>
                <Link
                  href={`/admin/organizaciones/${org.id}/borrar`}
                  className="inline-flex items-center gap-1 text-sm text-destructive hover:underline"
                >
                  <Trash2 className="size-3.5" />
                  Borrar
                </Link>
              </div>

              {org.users.length > 0 && (
                <ul className="mt-3 space-y-1">
                  {org.users.map((u) => (
                    <li key={u.id} className="flex items-center gap-2 text-sm">
                      <span className="text-muted-foreground">{u.email}</span>
                      <Badge variant="outline">{u.role}</Badge>
                    </li>
                  ))}
                </ul>
              )}

              {/* Cumplimiento (M9): sin política de privacidad no se pueden publicar
                  campañas que capten datos (formulario, WhatsApp, Instagram). */}
              <details open={!org.privacyPolicyUrl} className="mt-4 rounded-lg border border-border">
                <summary className="cursor-pointer px-4 py-3 text-sm">
                  <span className="inline-flex items-center gap-2">
                    {org.privacyPolicyUrl ? (
                      <>
                        <ShieldCheck className="size-4 text-emerald-400" />
                        Cumplimiento configurado
                      </>
                    ) : (
                      <>
                        <ShieldAlert className="size-4 text-amber-400" />
                        <span className="text-amber-400">Falta la política de privacidad</span>
                      </>
                    )}
                  </span>
                </summary>

                <form
                  method="POST"
                  action={`/api/admin/organizaciones/${org.id}/cumplimiento`}
                  className="space-y-3 border-t border-border p-4"
                >
                  <div className="space-y-2">
                    <Label htmlFor={`pp-${org.id}`}>URL de la política de privacidad</Label>
                    <Input
                      id={`pp-${org.id}`}
                      type="url"
                      name="privacyPolicyUrl"
                      defaultValue={org.privacyPolicyUrl ?? ""}
                      placeholder="https://viviendaonline.cl/politica-privacidad"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor={`ret-${org.id}`}>Retención de datos de leads (meses)</Label>
                    <Input
                      id={`ret-${org.id}`}
                      type="number"
                      name="dataRetentionMonths"
                      min={1}
                      max={120}
                      defaultValue={org.dataRetentionMonths}
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    La Ley 21.719 exige informar quién trata los datos, para qué y por cuánto tiempo.
                    Hay una plantilla en <code>docs/POLITICA_PRIVACIDAD.md</code>.
                  </p>
                  <Button type="submit" variant="outline" size="sm">
                    Guardar cumplimiento
                  </Button>
                </form>
              </details>

              <details className="mt-3 rounded-lg border border-border">
                <summary className="cursor-pointer px-4 py-3 text-sm">
                  <span className="inline-flex items-center gap-2">
                    <UserPlus className="size-4" />
                    Agregar usuario
                  </span>
                </summary>
                <form
                  method="POST"
                  action="/api/admin/usuarios"
                  className="space-y-3 border-t border-border p-4"
                >
                  <input type="hidden" name="organizationId" value={org.id} />
                  <Input type="email" name="email" placeholder="Email" required />
                  <Input
                    type="password"
                    name="password"
                    placeholder="Contraseña temporal (mín. 8 caracteres)"
                    required
                    minLength={8}
                  />
                  <select name="role" defaultValue="EDITOR" className={claseSelect}>
                    {ROLES.map((r) => (
                      <option key={r} value={r}>
                        {r}
                      </option>
                    ))}
                  </select>
                  <Button type="submit" variant="outline" size="sm">
                    Crear usuario
                  </Button>
                </form>
              </details>
            </div>
          ))}
        </div>

        <div className="rounded-xl border border-border bg-card p-5">
          <h2 className="mb-4 font-medium">Nueva inmobiliaria</h2>
          <form method="POST" action="/api/admin/organizaciones" className="max-w-sm space-y-3">
            <div className="space-y-2">
              <Label htmlFor="nombre-org">Nombre</Label>
              <Input id="nombre-org" name="name" required placeholder="Nombre de la inmobiliaria" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="rut-org">RUT (opcional)</Label>
              <Input id="rut-org" name="rut" />
            </div>
            <Button type="submit">
              <Plus className="size-4" />
              Crear organización
            </Button>
          </form>
        </div>
      </div>
    </AppShell>
  );
}
