import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { encrypt } from "@/lib/crypto";
import { getCurrentUser } from "@/lib/session";
import { resolveOrganizationForUser } from "@/lib/org";
import {
  exchangeCodeForToken,
  exchangeForLongLivedToken,
  fetchAdAccounts,
  fetchPages,
} from "@/lib/meta-oauth";
import { urlDeLaApp } from "@/lib/urls";

const STATE_COOKIE = "meta_oauth_state";

function redirectTo(request: Request, path: string) {
  return Response.redirect(urlDeLaApp(path, request));
}

export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user) return redirectTo(request, "/login");

  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const errorParam = url.searchParams.get("error");

  const cookieStore = await cookies();
  const expectedState = cookieStore.get(STATE_COOKIE)?.value;
  cookieStore.delete(STATE_COOKIE);

  if (errorParam) {
    // El usuario canceló el login en Meta, o Meta rechazó la solicitud.
    return redirectTo(request, `/conectar?error=${encodeURIComponent(errorParam)}`);
  }

  if (!code || !state || !expectedState || state !== expectedState) {
    return redirectTo(request, "/conectar?error=state_invalido");
  }

  try {
    const shortLived = await exchangeCodeForToken(code);
    const longLived = await exchangeForLongLivedToken(shortLived.access_token);

    const [adAccounts, pages] = await Promise.all([
      fetchAdAccounts(longLived.access_token),
      fetchPages(longLived.access_token),
    ]);

    if (adAccounts.length === 0) {
      return redirectTo(request, "/conectar?error=sin_cuentas_publicitarias");
    }

    // El usuario de Meta puede tener acceso a varias cuentas publicitarias (personales,
    // de otros negocios, etc.) — nunca se toma "la primera cuenta" a ciegas. Por ahora
    // se exige que sea exactamente la cuenta configurada en META_ALLOWED_AD_ACCOUNT_ID.
    // TODO (M1/M2, cuando exista selector de cuentas en la UI): permitir elegir entre
    // varias cuentas una vez que el aplicativo pase a producción (M13) con más clientes.
    const allowedAdAccountId = process.env.META_ALLOWED_AD_ACCOUNT_ID;
    const adAccount = adAccounts.find((a) => a.id === allowedAdAccountId);
    if (!adAccount) {
      const encontradas = adAccounts.map((a) => a.id).join(",");
      console.error(
        `La cuenta ${allowedAdAccountId} no está entre las cuentas del usuario: ${encontradas}`
      );
      return redirectTo(request, "/conectar?error=cuenta_no_encontrada");
    }

    const allowedPageId = process.env.META_ALLOWED_PAGE_ID;
    const page = pages.find((p) => p.id === allowedPageId);
    if (!page) {
      const encontradas = pages.map((p) => p.id).join(",");
      console.error(`La página ${allowedPageId} no está entre las páginas del usuario: ${encontradas}`);
    }

    const organization = await resolveOrganizationForUser(user);
    if (!organization) {
      return redirectTo(request, "/conectar?error=sin_organizacion");
    }

    const existing = await prisma.metaConnection.findFirst({
      where: { organizationId: organization.id, adAccountId: adAccount.id },
    });

    const data = {
      organizationId: organization.id,
      metaBusinessId: adAccount.business?.id ?? "",
      adAccountId: adAccount.id,
      pageId: page?.id,
      accessTokenEncrypted: encrypt(longLived.access_token),
      tokenType: "USER" as const,
      status: "ACTIVA" as const,
    };

    if (existing) {
      // connectedAt se refresca a propósito: al reconectar (por ejemplo después de
      // desconectar) la fila se reutiliza, y si no se actualizara la pantalla seguiría
      // mostrando la fecha de la primera conexión. Importa porque el token dura ~60
      // días contados desde ahora, no desde entonces.
      await prisma.metaConnection.update({
        where: { id: existing.id },
        data: { ...data, connectedAt: new Date() },
      });
    } else {
      await prisma.metaConnection.create({ data });
    }

    return redirectTo(request, "/conectar?status=ok");
  } catch (err) {
    console.error("Error en callback OAuth de Meta:", err);
    return redirectTo(request, "/conectar?error=fallo_intercambio_token");
  }
}
