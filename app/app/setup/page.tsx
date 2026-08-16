import Link from "next/link";
import { Building2 } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Aviso } from "@/app/components/app-shell";

export default async function SetupPage() {
  const yaHayUsuarios = (await prisma.user.count()) > 0;

  return (
    <div className="flex min-h-screen items-center justify-center px-6 py-12">
      <div className="w-full max-w-sm">
        <Link href="/" className="mb-8 flex items-center justify-center gap-2 text-lg font-semibold">
          <Building2 className="size-5 text-primary" />
          Inmob Ads
        </Link>

        <div className="rounded-xl border border-border bg-card p-6">
          {yaHayUsuarios ? (
            <>
              <h1 className="text-xl font-semibold tracking-tight">Configuración inicial</h1>
              <div className="mt-4">
                <Aviso tono="aviso">
                  Ya existe al menos un usuario. Esta página solo sirve para crear el primero.
                </Aviso>
              </div>
              <Link
                href="/login"
                className="mt-6 inline-block text-sm underline underline-offset-4 hover:text-foreground"
              >
                Ir a iniciar sesión →
              </Link>
            </>
          ) : (
            <>
              <h1 className="text-xl font-semibold tracking-tight">Crear el primer usuario</h1>
              <p className="mt-1 text-sm text-muted-foreground">
                Queda como administrador de agencia y puede administrar varias inmobiliarias.
              </p>

              <form method="POST" action="/api/auth/setup" className="mt-6 space-y-4">
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
                    minLength={8}
                    autoComplete="new-password"
                    className="h-10"
                  />
                  <p className="text-xs text-muted-foreground">
                    Mínimo 8 caracteres. Se guarda con hash: nadie puede leerla, ni siquiera desde la
                    base de datos.
                  </p>
                </div>

                <Button type="submit" className="h-10 w-full">
                  Crear usuario
                </Button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
