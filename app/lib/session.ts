import { cookies } from "next/headers";
import { validateSessionToken } from "@/lib/auth";

export const SESSION_COOKIE = "session";

// Helper para usar en Server Components y Route Handlers: devuelve el usuario
// logueado (con su organización) o null si no hay sesión válida.
export async function getCurrentUser() {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  return validateSessionToken(token);
}

export async function setSessionCookie(token: string, expiresAt: Date) {
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    expires: expiresAt,
    path: "/",
  });
}

export async function clearSessionCookie() {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE);
}
