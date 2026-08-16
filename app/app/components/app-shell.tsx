import Link from "next/link";
import {
  Building2,
  Megaphone,
  Home,
  BarChart3,
  Compass,
  Plug,
  Settings,
  LogOut,
} from "lucide-react";
import { Button } from "@/components/ui/button";

// Marco común de las pantallas con sesión iniciada: barra lateral + encabezado.
//
// Se implementa como un componente que cada página envuelve, en vez de un
// layout.tsx de Next: eso obligaría a mover todas las carpetas dentro de un grupo
// de rutas, y no vale el riesgo de romper las URLs que ya funcionan.

type Props = {
  titulo: string;
  descripcion?: string;
  usuario: { email: string; role: string };
  // Botones de acción que van arriba a la derecha (publicar, sincronizar, etc.).
  acciones?: React.ReactNode;
  // Ruta activa para resaltar el ítem del menú, ej. "/campanas".
  activo?: string;
  children: React.ReactNode;
};

// El orden sigue el flujo real de trabajo (ver lib/pasos.ts): primero la propiedad,
// que es el insumo, y después las campañas. "Conexión Meta" va al final porque se
// configura una sola vez; mientras falte, Inicio lo muestra como el paso pendiente.
const NAVEGACION = [
  { href: "/inicio", etiqueta: "Inicio", icono: Compass },
  { href: "/propiedades", etiqueta: "Propiedades", icono: Home },
  { href: "/campanas", etiqueta: "Campañas", icono: Megaphone },
  { href: "/reportes", etiqueta: "Reportes", icono: BarChart3 },
  { href: "/conectar", etiqueta: "Conexión Meta", icono: Plug },
];

export function AppShell({ titulo, descripcion, usuario, acciones, activo, children }: Props) {
  const esAdminAgencia = usuario.role === "ADMIN_AGENCIA";

  return (
    <div className="flex min-h-screen">
      {/* Barra lateral. En pantallas chicas se convierte en una fila horizontal
          arriba, para no tapar el contenido. */}
      <aside className="hidden w-60 shrink-0 border-r border-border bg-card/30 md:flex md:flex-col">
        <div className="border-b border-border px-6 py-5">
          <Link href="/campanas" className="flex items-center gap-2 font-semibold">
            <Building2 className="size-5 text-primary" />
            Inmob Ads
          </Link>
        </div>

        <nav className="flex-1 space-y-1 p-3">
          {NAVEGACION.map((item) => {
            const esActivo = activo === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors ${
                  esActivo
                    ? "bg-primary/10 font-medium text-primary"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                }`}
              >
                <item.icono className="size-4" />
                {item.etiqueta}
              </Link>
            );
          })}

          {esAdminAgencia && (
            <Link
              href="/admin/organizaciones"
              className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors ${
                activo === "/admin/organizaciones"
                  ? "bg-primary/10 font-medium text-primary"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              }`}
            >
              <Settings className="size-4" />
              Administración
            </Link>
          )}
        </nav>

        <div className="border-t border-border p-3">
          <div className="truncate px-3 pb-2 text-xs text-muted-foreground" title={usuario.email}>
            {usuario.email}
          </div>
          <form method="POST" action="/api/auth/logout">
            <Button type="submit" variant="ghost" size="sm" className="w-full justify-start">
              <LogOut className="size-4" />
              Cerrar sesión
            </Button>
          </form>
        </div>
      </aside>

      {/* Navegación compacta para móvil */}
      <div className="fixed inset-x-0 top-0 z-40 flex gap-1 overflow-x-auto border-b border-border bg-background/95 px-3 py-2 backdrop-blur md:hidden">
        {NAVEGACION.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={`flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs ${
              activo === item.href ? "bg-primary/10 text-primary" : "text-muted-foreground"
            }`}
          >
            <item.icono className="size-3.5" />
            {item.etiqueta}
          </Link>
        ))}
      </div>

      <main className="min-w-0 flex-1 pt-14 md:pt-0">
        <header className="border-b border-border px-6 py-5">
          <div className="mx-auto flex max-w-5xl flex-wrap items-start justify-between gap-4">
            <div className="min-w-0">
              <h1 className="truncate text-2xl font-semibold tracking-tight">{titulo}</h1>
              {descripcion && <p className="mt-1 text-sm text-muted-foreground">{descripcion}</p>}
            </div>
            {acciones && <div className="flex flex-wrap items-center gap-2">{acciones}</div>}
          </div>
        </header>

        <div className="mx-auto max-w-5xl px-6 py-8">{children}</div>
      </main>
    </div>
  );
}

// Aviso reutilizable para mensajes de éxito, advertencia y error.
export function Aviso({
  tono,
  children,
}: {
  tono: "ok" | "aviso" | "error";
  children: React.ReactNode;
}) {
  const estilos = {
    ok: "border-emerald-500/30 bg-emerald-500/10 text-emerald-400",
    aviso: "border-amber-500/30 bg-amber-500/10 text-amber-400",
    error: "border-destructive/30 bg-destructive/10 text-destructive",
  }[tono];

  return <div className={`rounded-lg border px-4 py-3 text-sm ${estilos}`}>{children}</div>;
}
