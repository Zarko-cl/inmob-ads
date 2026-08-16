import { prisma } from "@/lib/prisma";
import { verifyPassword, generateSessionToken, createSession } from "@/lib/auth";
import { setSessionCookie } from "@/lib/session";
import { urlDeLaApp } from "@/lib/urls";

// Hash "señuelo" para comparar contra él cuando el email no existe: así verificar
// un email inexistente tarda lo mismo que uno que sí existe, y no se puede usar el
// tiempo de respuesta para adivinar qué emails están registrados.
const DUMMY_HASH = "$2a$12$C6UzMDM.H6dfI/f/IKcEeOoTBK9AJn.Y1a3rJnUXjM6oxUW9VVfWq";

export async function POST(request: Request) {
  const form = await request.formData();
  const email = String(form.get("email") ?? "").trim().toLowerCase();
  const password = String(form.get("password") ?? "");

  const user = await prisma.user.findUnique({ where: { email } });
  const passwordOk = await verifyPassword(password, user?.passwordHash ?? DUMMY_HASH);

  if (!user || !passwordOk) {
    return Response.redirect(urlDeLaApp("/login?error=1", request));
  }

  const token = generateSessionToken();
  const expiresAt = await createSession(token, user.id);
  await setSessionCookie(token, expiresAt);
  await prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });

  return Response.redirect(urlDeLaApp("/inicio", request));
}
