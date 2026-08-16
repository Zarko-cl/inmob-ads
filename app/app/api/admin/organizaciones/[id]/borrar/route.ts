import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/session";
import { urlDeLaApp } from "@/lib/urls";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user || user.role !== "ADMIN_AGENCIA") {
    return new Response("No autorizado", { status: 403 });
  }

  const { id } = await params;
  // onDelete: Cascade en el schema borra en cadena los usuarios (y sus sesiones)
  // y las conexiones de Meta de esta organización — ver prisma/schema.prisma.
  await prisma.organization.delete({ where: { id } });

  return Response.redirect(urlDeLaApp("/admin/organizaciones", request));
}
