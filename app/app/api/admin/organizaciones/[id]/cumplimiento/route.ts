import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/session";
import { urlDeLaApp } from "@/lib/urls";

// Guarda los datos de cumplimiento de una inmobiliaria (M9): la URL de su política
// de privacidad y el plazo de retención de los datos de leads (Ley 21.719).
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return Response.redirect(urlDeLaApp("/login", request));
  if (user.role !== "ADMIN_AGENCIA") return new Response("No autorizado", { status: 403 });

  const { id } = await params;
  const form = await request.formData();
  const url = String(form.get("privacyPolicyUrl") ?? "").trim();
  const meses = Number(form.get("dataRetentionMonths"));

  if (url && !url.startsWith("https://")) {
    return new Response("La política de privacidad debe ser una URL https:// pública.", { status: 400 });
  }
  if (!Number.isFinite(meses) || meses < 1 || meses > 120) {
    return new Response("El plazo de retención debe estar entre 1 y 120 meses.", { status: 400 });
  }

  await prisma.organization.update({
    where: { id },
    data: { privacyPolicyUrl: url || null, dataRetentionMonths: Math.round(meses) },
  });

  return Response.redirect(urlDeLaApp("/admin/organizaciones", request));
}
