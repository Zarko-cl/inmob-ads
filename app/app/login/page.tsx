import Link from "next/link";
import { Building2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Aviso } from "@/app/components/app-shell";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  return (
    <div className="flex min-h-screen items-center justify-center px-6 py-12">
      <div className="w-full max-w-sm">
        <Link href="/" className="mb-8 flex items-center justify-center gap-2 text-lg font-semibold">
          <Building2 className="size-5 text-primary" />
          Inmob Ads
        </Link>

        <div className="rounded-xl border border-border bg-card p-6">
          <h1 className="text-xl font-semibold tracking-tight">Iniciar sesión</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Entra con tu cuenta para gestionar las campañas.
          </p>

          {error && (
            <div className="mt-4">
              <Aviso tono="error">Email o contraseña incorrectos.</Aviso>
            </div>
          )}

          <form method="POST" action="/api/auth/login" className="mt-6 space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" name="email" required autoComplete="email" className="h-10" />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Contraseña</Label>
              <Input
                id="password"
                type="password"
                name="password"
                required
                autoComplete="current-password"
                className="h-10"
              />
            </div>

            <Button type="submit" className="h-10 w-full">
              Entrar
            </Button>
          </form>
        </div>

        <p className="mt-6 text-center text-xs text-muted-foreground">
          ¿Primera vez? El usuario inicial se crea en{" "}
          <Link href="/setup" className="underline underline-offset-4 hover:text-foreground">
            /setup
          </Link>
        </p>
      </div>
    </div>
  );
}
