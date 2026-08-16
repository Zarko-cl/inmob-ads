import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/session";
import { hashPassword } from "@/lib/auth";
import { urlDeLaApp } from "@/lib/urls";

const ROLES_VALIDOS = ["ADMIN_INMOBILIARIA", "EDITOR", "SOLO_LECTURA"] as const;

// Crea un usuario dentro de una organización. Solo lo puede hacer un admin de
// agencia (por ahora — cuando exista un "admin_inmobiliaria" con más permisos,
// M2 podría extender esto para que también invite gente a su propia organización).
export async function POST(request: Request) {
  const currentUser = await getCurrentUser();
  if (!currentUser || currentUser.role !== "ADMIN_AGENCIA") {
    return new Response("No autorizado", { status: 403 });
  }

  const form = await request.formData();
  const organizationId = String(form.get("organizationId") ?? "");
  const email = String(form.get("email") ?? "").trim().toLowerCase();
  const password = String(form.get("password") ?? "");
  const role = String(form.get("role") ?? "");

  if (!organizationId || !email || password.length < 8) {
    return new Response("Datos inválidos (contraseña mínimo 8 caracteres).", { status: 400 });
  }
  if (!ROLES_VALIDOS.includes(role as (typeof ROLES_VALIDOS)[number])) {
    return new Response("Rol inválido.", { status: 400 });
  }

  const passwordHash = await hashPassword(password);
  await prisma.user.create({
    data: {
      organizationId,
      email,
      passwordHash,
      role: role as (typeof ROLES_VALIDOS)[number],
    },
  });

  return Response.redirect(urlDeLaApp("/admin/organizaciones", request));
}
