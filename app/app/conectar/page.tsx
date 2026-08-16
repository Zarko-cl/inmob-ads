import Link from "next/link";
import { redirect } from "next/navigation";
import { CheckCircle2, Plug, Unplug } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/session";
import { resolveOrganizationForUser } from "@/lib/org";
import { buttonVariants } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AppShell, Aviso } from "@/app/components/app-shell";

const ERRORES: Record<string, string> = {
  state_invalido: "La sesión de login expiró o no es válida. Intenta de nuevo.",
  sin_cuentas_publicitarias: "Tu usuario de Meta no tiene ninguna cuenta publicitaria asociada.",
  sin_organizacion: "No hay ninguna organización creada todavía en la base de datos.",
  fallo_intercambio_token: "Meta rechazó la conexión. Revisa los logs del servidor para más detalle.",
  cuenta_no_encontrada:
    "Tu usuario de Meta no tiene acceso a la cuenta publicitaria configurada (META_ALLOWED_AD_ACCOUNT_ID).",
};

export default async function ConectarPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; error?: string; revocado?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const { status, error, revocado } = await searchParams;

  const organization = await resolveOrganizationForUser(user);
  const conexion = organization
    ? await prisma.metaConnection.findFirst({ where: { organizationId: organization.id } })
    : null;

  return (
    <AppShell
      titulo="Conexión con Meta"
      descripcion={organization?.name ?? "Sin organización"}
      usuario={user}
      activo="/conectar"
    >
      <div className="max-w-2xl space-y-6">
        {status === "ok" && <Aviso tono="ok">Cuenta conectada correctamente.</Aviso>}
        {status === "desconectada" && (
          <Aviso tono={revocado === "1" ? "ok" : "aviso"}>
            {revocado === "1"
              ? "Cuenta desconectada. Se retiró el permiso en Meta; al reconectar te lo va a pedir de nuevo."
              : "Cuenta desconectada de la app. Meta no confirmó el retiro del permiso, así que puede que al reconectar no te lo vuelva a pedir."}
          </Aviso>
        )}
        {error && <Aviso tono="error">{ERRORES[error] ?? error}</Aviso>}

        {conexion ? (
          <div className="rounded-xl border border-border bg-card p-6">
            <div className="mb-4 flex items-center gap-2">
              <CheckCircle2 className="size-5 text-emerald-400" />
              <span className="font-medium">Cuenta publicitaria conectada</span>
              <Badge variant="secondary">{conexion.status}</Badge>
            </div>

            <dl className="grid gap-3 text-sm sm:grid-cols-2">
              <div>
                <dt className="text-muted-foreground">Cuenta publicitaria</dt>
                <dd className="font-mono text-xs">{conexion.adAccountId}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Página de Facebook</dt>
                <dd className="font-mono text-xs">{conexion.pageId ?? "sin página"}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Conectada</dt>
                <dd>{conexion.connectedAt.toLocaleString("es-CL")}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Tipo de token</dt>
                <dd>{conexion.tokenType}</dd>
              </div>
            </dl>

            <div className="mt-6 flex flex-wrap gap-3">
              <Link href="/campanas" className={buttonVariants({ size: "sm" })}>
                Ir a campañas
              </Link>
              <a
                href="/api/meta/connect"
                className={buttonVariants({ variant: "outline", size: "sm" })}
              >
                Reconectar cuenta
              </a>
              <Link
                href="/conectar/desconectar"
                className={buttonVariants({ variant: "ghost", size: "sm", className: "text-destructive" })}
              >
                <Unplug className="size-4" />
                Desconectar
              </Link>
            </div>
          </div>
        ) : (
          <div className="rounded-xl border border-dashed border-border p-10 text-center">
            <Plug className="mx-auto mb-3 size-8 text-muted-foreground" />
            <p className="mb-6 text-sm text-muted-foreground">
              Todavía no hay ninguna cuenta de Meta conectada. Al conectarla, la app podrá crear
              campañas en tu nombre sin que compartas tu contraseña.
            </p>
            <a href="/api/meta/connect" className={buttonVariants({ className: "h-10 px-5" })}>
              Conectar cuenta de Meta
            </a>
          </div>
        )}
      </div>
    </AppShell>
  );
}
