# Checklist de configuración externa en Meta (M0 / M1)

**Para quién es este documento:** para ti (Paul), porque estos pasos requieren tu cuenta de Meta Business y no pueden ejecutarse por mí. Una vez completados, me pasas los IDs/valores indicados en **"Qué necesito que me compartas"** y puedo continuar con el desarrollo de M0/M1.

## Requisitos previos

- Una cuenta personal de Facebook que sea administradora del **Business Manager** de la inmobiliaria (o de la agencia, si van a centralizar ahí el desarrollo).
- Si aún no existe un Business Manager para esto: crear uno en business.facebook.com → Configuración de la empresa.

## Paso 1 — Crear la app en Meta for Developers

1. Ir a [developers.facebook.com](https://developers.facebook.com) → **Mis apps** → **Crear app**.
2. Elegir tipo de app **"Empresa" (Business)** — es el único tipo compatible con el producto Marketing API.
3. Nombrar la app (sugerencia: `MetaAds Inmobiliaria - Dev`) y asociarla al Business Manager del paso anterior.
4. Dentro del panel de la app, ir a **Agregar producto** → **Marketing API** → Configurar.

## Paso 2 — Vincular la app al Business Manager

1. En la app, ir a **Configuración → Avanzada** y confirmar que quede vinculada al Business Manager correcto.
2. Sin este paso, los tokens que se generen no van a poder ver las cuentas publicitarias aunque los permisos estén bien configurados.

## Paso 3 — Crear la cuenta publicitaria sandbox

1. Dentro de la app, ir a la sección **Marketing API → Herramientas**.
2. En **Sandbox Ad Account Management**, crear una cuenta sandbox y ponerle nombre (ej. `Sandbox - Desarrollo`).
3. Esta cuenta permite crear campañas/anuncios reales a nivel de API sin gastar presupuesto ni entregar anuncios de verdad — es el ambiente donde vamos a desarrollar y probar M1 a M12 antes de tocar una cuenta real de un cliente.
4. Nota: solo se puede crear **una** cuenta sandbox por app, independiente del nivel de acceso.

## Paso 4 — Generar un token de prueba

1. Ir a **Herramientas → Graph API Explorer** dentro del panel de desarrollador.
2. Seleccionar la app creada, y generar un **User Access Token** con los permisos `ads_management`, `ads_read` y `business_management`.
3. Este token inicial es solo para pruebas manuales; en el desarrollo real (M1) se implementará el flujo OAuth completo y el uso de System User Access Tokens de larga duración, como se describe en `ARQUITECTURA.md`.

## Paso 5 — Página de Facebook e Instagram (para M5, no bloqueante ahora)

Si ya existen, anotar:
- ID de la Página de Facebook de la inmobiliaria (para anuncios y Click-to-Messenger).
- Cuenta de Instagram profesional vinculada a esa Página (para Click-to-Instagram y anuncios en Instagram).

## Paso 6 — WhatsApp Business Platform (para M5, no bloqueante ahora)

Si ya tienen o planean usar WhatsApp Business Platform (Cloud API) para las campañas Click-to-WhatsApp:
- Confirmar si van a usar el número de WhatsApp Business actual de la inmobiliaria o uno nuevo dedicado a campañas.
- Esto se configura formalmente en M1/M5; por ahora basta con saber la intención.

## Paso 7 — Iniciar el proceso de App Review (en paralelo, no bloqueante para empezar a programar)

- El App Review para los permisos `ads_management` y `business_management` con **Advanced Access** (necesario para operar cuentas de clientes reales, no solo la tuya) puede tardar varias semanas.
- Se puede iniciar en paralelo al desarrollo de M0–M3, ya que el desarrollo y las pruebas corren contra la cuenta sandbox mientras tanto.
- Este paso normalmente pide: descripción del caso de uso, un video mostrando el flujo de la app usando cada permiso solicitado, y política de privacidad publicada.

## Qué necesito que me compartas cuando completes los pasos 1–4

- Nombre/ID de la app de Meta for Developers.
- ID de la cuenta publicitaria sandbox creada.
- Confirmación de que la app quedó vinculada al Business Manager correcto.

Con eso, en M1 implementamos el flujo real de conexión OAuth y dejamos el entorno de desarrollo apuntando a la cuenta sandbox.

## ✅ Entorno de desarrollo — completado el 11 de agosto de 2026

| Dato | Valor |
|---|---|
| App (nombre) | Inmob-Dev |
| App ID | `894046786778589` |
| Business Manager | Viviendaonline |
| Business Manager ID | `2640839882747965` |
| Cuenta publicitaria sandbox | Sandbox - Desarrollo |
| ID cuenta sandbox | `act_1678205470139765` |
| Divisa / zona horaria | CLP / America/Santiago |
| Página vinculada | Viviendaonline.cl (`191584350710443`) |
| Casos de uso habilitados | Crear y administrar anuncios (Marketing API), Captar clientes potenciales, Medir rendimiento, WhatsApp |
| Marketing API Access Tier | Limited (sube a estándar/avanzado al publicar la app + aprobar App Review — ver Paso 7) |
| Token de prueba | Generado por Paul, **no se comparte ni se guarda en el repositorio** — se usa solo para pruebas manuales puntuales |
| App Secret | **No compartido, no debe guardarse en el repositorio** — solo en el gestor de secretos al iniciar M1 |

**Pendiente para M1:** activar y configurar Facebook Login for Business (el caso de uso estándar de "Inicio de sesión con Facebook" quedó deshabilitado por conflicto con Marketing API, según se vio en el asistente de creación — se resuelve configurando el flujo OAuth directamente en el código de M1, usando el App ID/Secret desde el gestor de secretos).

## ⚠️ Corrección importante (11 ago 2026) — la cuenta sandbox no sirve para probar el login OAuth

Al implementar el flujo OAuth de M1 se descubrió que la cuenta sandbox `act_1678205470139765` **no aparece** entre las cuentas publicitarias que devuelve el login normal de Facebook Business (`/me/adaccounts`), ni figura en "Cuentas publicitarias" del Business Manager en business.facebook.com. Las cuentas sandbox de Meta están pensadas para probar llamadas a la Marketing API directamente (Graph API Explorer, tokens de prueba manuales), **no** para conectarse vía Business Login — son dos mecanismos distintos de Meta que no se cruzan.

En la práctica, el login OAuth (que es exactamente lo que usará una inmobiliaria real en producción) siempre va a devolver cuentas publicitarias reales del usuario. Por eso, mientras se desarrolla M1 en este computador, la conexión se hace contra la cuenta publicitaria real del Business Manager Viviendaonline:

| Dato | Valor |
|---|---|
| Cuenta publicitaria (uso en desarrollo) | ViviendaOnLine |
| ID | `1039252130669863` |

**Esto significa que a partir de M3 (motor de campañas) hay que ser especialmente cuidadosos**: toda campaña que se cree contra esta cuenta durante el desarrollo debe quedar siempre en borrador/pausada, y nunca publicarse con presupuesto activo sin confirmación explícita — porque, a diferencia de la sandbox, esta cuenta sí puede gastar dinero real si se publica una campaña activa.

---
**Fuentes:** [Marketing API — Sandbox Ad Accounts (Meta for Developers)](https://developers.facebook.com/ads/blog/post/v2/2016/10/19/sandbox-ad-accounts/), [App Setup — Business Management APIs (Meta for Developers)](https://developers.facebook.com/docs/business-management-apis/2tier-bm-solution/prerequisites/app-setup/)
