import Link from "next/link";
import { redirect, notFound } from "next/navigation";
import { Trash2, AlertTriangle } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/session";
import { Button, buttonVariants } from "@/components/ui/button";
import { AppShell } from "@/app/components/app-shell";

export default async function BorrarOrganizacionPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  if (user.role !== "ADMIN_AGENCIA") {
    return (
      <AppShell titulo="Borrar inmobiliaria" usuario={user} activo="/admin/organizaciones">
        <p className="text-sm text-muted-foreground">
          No tienes permiso para hacer esto (se requiere rol de administrador de agencia).
        </p>
      </AppShell>
    );
  }

  const { id } = await params;
  const organization = await prisma.organization.findUnique({
    where: { id },
    include: { users: true, metaConnections: true },
  });
  if (!organization) notFound();

  return (
    <div className="flex min-h-screen items-center justify-center px-6 py-12">
      <div className="w-full max-w-lg">
        <div className="rounded-xl border border-destructive/40 bg-card p-6 shadow-[0_0_50px_-20px] shadow-destructive/40">
          <div className="mb-4 flex items-center gap-2">
            <Trash2 className="size-5 text-destructive" />
            <h1 className="text-lg font-semibold">Borrar inmobiliaria</h1>
          </div>

          <p className="text-sm text-muted-foreground">
            Estás por borrar <strong className="text-foreground">{organization.name}</strong> de forma
            permanente.
          </p>

          <div className="mt-4 rounded-lg border border-destructive/30 bg-destructive/10 p-4">
            <p className="flex items-center gap-2 font-medium text-destructive">
              <AlertTriangle className="size-4" />
              Esta acción no se puede deshacer.
            </p>
            <ul className="mt-3 list-inside list-disc space-y-1 text-sm text-muted-foreground">
              <li>
                {organization.users.length} usuario(s): ya no van a poder iniciar sesión
              </li>
              <li>{organization.metaConnections.length} conexión(es) con Meta guardada(s)</li>
            </ul>
          </div>

          <div className="mt-6 flex flex-wrap gap-3">
            <form method="POST" action={`/api/admin/organizaciones/${organization.id}/borrar`}>
              <Button type="submit" variant="destructive" className="h-10">
                <Trash2 className="size-4" />
                Sí, borrar definitivamente
              </Button>
            </form>
            <Link
              href="/admin/organizaciones"
              className={buttonVariants({ variant: "outline", className: "h-10" })}
            >
              Cancelar
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
