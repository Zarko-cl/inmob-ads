import { cookies } from "next/headers";
import { invalidateSessionToken } from "@/lib/auth";
import { SESSION_COOKIE, clearSessionCookie } from "@/lib/session";
import { urlDeLaApp } from "@/lib/urls";

export async function POST(request: Request) {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (token) await invalidateSessionToken(token);
  await clearSessionCookie();
  return Response.redirect(urlDeLaApp("/login", request));
}
