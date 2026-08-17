import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/session";
import { resolveOrganizationForUser } from "@/lib/org";
import { guardarArchivo, storageConfigurado } from "@/lib/storage";
import { validarArchivo } from "@/lib/storage-limits";

// Recibe la foto y la guarda donde corresponda según STORAGE_PROVIDER (ver
// lib/storage.ts). El archivo pasa por el servidor, así que este es también el
// último punto donde se valida peso y tipo — el navegador es manipulable.
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return Response.json({ error: "No autorizado" }, { status: 401 });

  const organization = await resolveOrganizationForUser(user);
  if (!organization) return Response.json({ error: "No hay organización" }, { status: 400 });

  if (!storageConfigurado()) {
    return Response.json(
      {
        error:
          "El almacenamiento de archivos no está configurado. En el servidor hay que " +
          "usar STORAGE_PROVIDER=vercel-blob con su store conectado; el modo local " +
          "solo funciona en un computador.",
      },
      { status: 500 }
    );
  }

  const { id } = await params;
  const property = await prisma.property.findFirst({
    where: { id, organizationId: organization.id },
    include: { media: true },
  });
  if (!property) return Response.json({ error: "Propiedad no encontrada" }, { status: 404 });

  const form = await request.formData();
  const archivo = form.get("archivo");
  if (!(archivo instanceof File)) {
    return Response.json({ error: "No se recibió ningún archivo." }, { status: 400 });
  }

  const problema = validarArchivo(archivo);
  if (problema) return Response.json({ error: problema }, { status: 400 });

  try {
    const guardado = await guardarArchivo(archivo);

    const foto = await prisma.propertyMedia.create({
      data: {
        propertyId: property.id,
        url: guardado.url,
        pathname: guardado.pathname,
        sizeBytes: archivo.size,
        contentType: archivo.type,
        orden: property.media.length,
      },
    });

    return Response.json({ foto });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Error guardando la foto";
    console.error("Error subiendo foto:", err);
    return Response.json({ error: message }, { status: 500 });
  }
}
