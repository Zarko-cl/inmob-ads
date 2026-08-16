import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/session";
import { resolveOrganizationForUser } from "@/lib/org";
import { decrypt } from "@/lib/crypto";
import { registrarAuditoria } from "@/lib/auditoria";
import { urlDeLaApp } from "@/lib/urls";

const API = "https://graph.facebook.com/v21.0";

// Desconecta la cuenta de Meta.
//
// Dos cosas pasan acá, y las dos importan:
//   1. Se revocan los permisos EN META (`DELETE /me/permissions`). Sin esto, el token
//      que ya no usamos seguiría vivo hasta 60 días. Además obliga a volver a aceptar
//      el diálogo de permisos al reconectar, que es justamente el flujo de un usuario
//      que entra por primera vez.
//   2. Se borra el token de nuestra base y la conexión queda REVOCADA.
//
// La conexión NO se elimina: las campañas ya creadas la referencian (Campaign
// .metaConnectionId es obligatorio) y borrarla las arrastraría. Al quedar en REVOCADA
// deja de aparecer en todas las consultas, que filtran por status ACTIVA, así que la
// app se comporta como si nunca se hubiera conectado.
export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return Response.redirect(urlDeLaApp("/login", request));

  const organization = await resolveOrganizationForUser(user);
  if (!organization) return new Response("No hay organización.", { status: 400 });

  const conexion = await prisma.metaConnection.findFirst({
    where: { organizationId: organization.id, status: "ACTIVA" },
  });
  if (!conexion) {
    return Response.redirect(urlDeLaApp("/conectar", request));
  }

  // Revocar en Meta es "mejor esfuerzo": si falla (token ya vencido, red caída), la
  // desconexión local se hace igual. Quedarnos con el token guardado porque Meta no
  // respondió sería el peor de los dos resultados.
  let revocadoEnMeta = false;
  try {
    const token = decrypt(conexion.accessTokenEncrypted);
    const res = await fetch(`${API}/me/permissions?access_token=${encodeURIComponent(token)}`, {
      method: "DELETE",
    });
    const json = await res.json();
    revocadoEnMeta = json?.success === true;
    if (!revocadoEnMeta) console.error("Meta no confirmó la revocación:", json);
  } catch (err) {
    console.error("No se pudieron revocar los permisos en Meta:", err);
  }

  await prisma.metaConnection.update({
    where: { id: conexion.id },
    data: {
      status: "REVOCADA",
      // El token deja de existir en la base. La columna es obligatoria, así que se
      // vacía en vez de ponerse en null.
      accessTokenEncrypted: "",
    },
  });

  await registrarAuditoria({
    organizationId: organization.id,
    actor: user,
    action: "META_DESCONECTADA",
    entityType: "MetaConnection",
    entityId: conexion.id,
    metadata: { adAccountId: conexion.adAccountId, revocadoEnMeta },
  });

  return Response.redirect(
    urlDeLaApp(`/conectar?status=desconectada&revocado=${revocadoEnMeta ? "1" : "0"}`, request)
  );
}
