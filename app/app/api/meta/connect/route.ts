import { randomBytes } from "crypto";
import { cookies } from "next/headers";
import { buildAuthorizeUrl } from "@/lib/meta-oauth";
import { getCurrentUser } from "@/lib/session";
import { urlDeLaApp } from "@/lib/urls";

const STATE_COOKIE = "meta_oauth_state";

// Inicia el flujo: genera un "state" (protección CSRF), lo guarda en una cookie
// de corta duración, y manda al usuario al diálogo de login de Meta.
export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user) return Response.redirect(urlDeLaApp("/login", request));

  const state = randomBytes(16).toString("hex");

  const cookieStore = await cookies();
  cookieStore.set(STATE_COOKIE, state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 60 * 10, // 10 minutos: tiempo de sobra para completar el login
    path: "/",
  });

  return Response.redirect(buildAuthorizeUrl(state));
}
