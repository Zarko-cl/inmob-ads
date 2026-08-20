// Flujo OAuth con Meta (Facebook Login for Business) — M1.
// Referencias: developers.facebook.com/docs/facebook-login/guides/access-tokens

const API_VERSION = "v21.0";
const GRAPH_URL = `https://graph.facebook.com/${API_VERSION}`;

// Permisos mínimos necesarios (ver docs/Plan_Trabajo_App_MetaAds_Inmobiliaria_v2.md, M1).
// Permisos que se le piden al usuario en el login de Facebook.
//
// `pages_read_engagement` y `pages_manage_ads` se agregaron el 16 ago 2026: sin ellos
// el token **no puede leer la Página** — pedir hasta su nombre devuelve
// "(#100) Object does not exist... due to missing permission". Eso bloquea todo lo de
// WhatsApp, porque el número de WhatsApp Business cuelga de la Página, y son además
// los permisos que exige la documentación de Click-to-WhatsApp.
//
// `whatsapp_business_management` se agregó el 20 ago 2026. Con los permisos de Página
// ya se puede leer la Página, pero enumerar las cuentas de WhatsApp Business
// (`GET /{business-id}/owned_whatsapp_business_accounts`) seguía respondiendo
// "(#200) You do not have permission to access this field". Es un permiso avanzado:
// Facebook lo concede a quien tenga un rol en la app (administrador, desarrollador o
// tester) sin App Review, pero para usuarios ajenos exigirá la revisión (M13).
//
// Ojo: cambiar esta lista NO afecta a los tokens ya emitidos. Hay que desconectar y
// volver a conectar para que Facebook pida los permisos nuevos.
const SCOPES = [
  "ads_management",
  "ads_read",
  "business_management",
  "pages_show_list",
  "pages_read_engagement",
  "pages_manage_ads",
  "whatsapp_business_management",
];

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Falta la variable de entorno ${name} (ver .env.local).`);
  return value;
}

export function buildAuthorizeUrl(state: string): string {
  const appId = requireEnv("META_APP_ID");
  const redirectUri = requireEnv("META_REDIRECT_URI");

  const params = new URLSearchParams({
    client_id: appId,
    redirect_uri: redirectUri,
    state,
    scope: SCOPES.join(","),
    response_type: "code",
  });

  return `https://www.facebook.com/${API_VERSION}/dialog/oauth?${params.toString()}`;
}

type MetaTokenResponse = {
  access_token: string;
  token_type: string;
  expires_in?: number;
};

export async function exchangeCodeForToken(code: string): Promise<MetaTokenResponse> {
  const appId = requireEnv("META_APP_ID");
  const appSecret = requireEnv("META_APP_SECRET");
  const redirectUri = requireEnv("META_REDIRECT_URI");

  const params = new URLSearchParams({
    client_id: appId,
    client_secret: appSecret,
    redirect_uri: redirectUri,
    code,
  });

  const res = await fetch(`${GRAPH_URL}/oauth/access_token?${params.toString()}`);
  if (!res.ok) {
    throw new Error(`Meta rechazó el intercambio del code: ${await res.text()}`);
  }
  return res.json();
}

// Los tokens de usuario que entrega el paso anterior duran ~1-2 horas.
// Este intercambio los convierte en un token de larga duración (~60 días).
export async function exchangeForLongLivedToken(
  shortLivedToken: string
): Promise<MetaTokenResponse> {
  const appId = requireEnv("META_APP_ID");
  const appSecret = requireEnv("META_APP_SECRET");

  const params = new URLSearchParams({
    grant_type: "fb_exchange_token",
    client_id: appId,
    client_secret: appSecret,
    fb_exchange_token: shortLivedToken,
  });

  const res = await fetch(`${GRAPH_URL}/oauth/access_token?${params.toString()}`);
  if (!res.ok) {
    throw new Error(`Meta rechazó el intercambio por token de larga duración: ${await res.text()}`);
  }
  return res.json();
}

type AdAccount = { id: string; name: string; business?: { id: string; name: string } };

export async function fetchAdAccounts(accessToken: string): Promise<AdAccount[]> {
  const params = new URLSearchParams({
    fields: "id,name,business",
    access_token: accessToken,
  });
  const res = await fetch(`${GRAPH_URL}/me/adaccounts?${params.toString()}`);
  if (!res.ok) {
    throw new Error(`No se pudieron leer las cuentas publicitarias: ${await res.text()}`);
  }
  const data = await res.json();
  return data.data ?? [];
}

type Page = { id: string; name: string };

export async function fetchPages(accessToken: string): Promise<Page[]> {
  const params = new URLSearchParams({
    fields: "id,name",
    access_token: accessToken,
  });
  const res = await fetch(`${GRAPH_URL}/me/accounts?${params.toString()}`);
  if (!res.ok) {
    throw new Error(`No se pudieron leer las Páginas: ${await res.text()}`);
  }
  const data = await res.json();
  return data.data ?? [];
}
