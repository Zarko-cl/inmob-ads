import { prisma } from "@/lib/prisma";
import { hashPassword, generateSessionToken, createSession } from "@/lib/auth";
import { setSessionCookie } from "@/lib/session";
import { urlDeLaApp } from "@/lib/urls";

// Solo funciona si todavía no existe ningún usuario — evita que alguien cree
// más cuentas de administrador de agencia por esta vía una vez que ya hay una.
export async function POST(request: Request) {
  const existentes = await prisma.user.count();
  if (existentes > 0) {
    return new Response("Ya existe un usuario. Ve a /login.", { status: 403 });
  }

  const form = await request.formData();
  const email = String(form.get("email") ?? "").trim().toLowerCase();
  const password = String(form.get("password") ?? "");

  if (!email || password.length < 8) {
    return new Response("Email o contraseña inválidos (mínimo 8 caracteres).", { status: 400 });
  }

  const passwordHash = await hashPassword(password);
  const user = await prisma.user.create({
    data: { email, passwordHash, role: "ADMIN_AGENCIA", organizationId: null },
  });

  const token = generateSessionToken();
  const expiresAt = await createSession(token, user.id);
  await setSessionCookie(token, expiresAt);

  return Response.redirect(urlDeLaApp("/conectar", request));
}
