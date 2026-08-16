// Construcción de URLs absolutas de la propia app.
//
// El problema que resuelve: las rutas de API redirigen con
// `Response.redirect(new URL("/inicio", request.url))`. `request.url` usa el host con
// el que llegó la petición **al servidor**, que detrás de un proxy no es el host
// público. Con un túnel de Cloudflare (o cualquier proxy inverso) el resultado era
// `https://localhost:3000/inicio`: el protocolo del visitante mezclado con el host
// interno. Una URL imposible, que el navegador rechaza con ERR_SSL_PROTOCOL_ERROR.
//
// La solución es tener una fuente de verdad explícita del host público: la variable
// de entorno APP_URL. Deliberadamente NO se usa el encabezado `X-Forwarded-Host` que
// manda el proxy: cualquiera puede enviarlo, y confiar en él permitiría que un
// atacante hiciera que nuestras redirecciones apuntaran a su propio sitio (una forma
// conocida de phishing).
//
// Si APP_URL no está definida se cae al comportamiento anterior, que es el correcto
// cuando no hay proxy de por medio (desarrollo directo en localhost).

export function urlDeLaApp(ruta: string, request: Request): URL {
  const base = process.env.APP_URL;
  return base ? new URL(ruta, base) : new URL(ruta, request.url);
}

// Atajo para el caso más común: redirigir a una ruta de la app.
export function redirigirA(ruta: string, request: Request): Response {
  return Response.redirect(urlDeLaApp(ruta, request));
}
