import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/session";
import { urlDeLaApp } from "@/lib/urls";

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user || user.role !== "ADMIN_AGENCIA") {
    return new Response("No autorizado", { status: 403 });
  }

  const form = await request.formData();
  const name = String(form.get("name") ?? "").trim();
  const rut = String(form.get("rut") ?? "").trim();

  if (!name) {
    return new Response("Falta el nombre de la organización.", { status: 400 });
  }

  await prisma.organization.create({ data: { name, rut: rut || null } });

  return Response.redirect(urlDeLaApp("/admin/organizaciones", request));
}
