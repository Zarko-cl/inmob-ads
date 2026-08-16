# Prompts /goal para Claude Code — completar el aplicativo por módulo

Este documento son "recetas" listas para copiar y pegar en Claude Code, usando el comando `/goal`.

## Cómo funciona `/goal` (para que sepas qué esperar)

`/goal <condición>` le dice a Claude Code una condición de término observable (un archivo que debe existir, un build que debe pasar, una función que debe funcionar). Claude Code sigue trabajando turno tras turno **sin pedirte permiso en cada paso**, y un modelo evaluador aparte revisa después de cada turno si la condición ya se cumplió. Cuando se cumple, para solo y te devuelve el control. Puedes escribir `/goal` solo (sin nada más) para ver el progreso, o `/goal clear` para cortarlo a mano.

**Por qué no te doy un solo `/goal` gigante para "terminar toda la app":** `/goal` funciona mejor con **una condición medible a la vez**, no con objetivos vagos. Además, este proyecto ya está conectado a una cuenta publicitaria **real** de Meta (`act_1039252130669863`, ver `CLAUDE.md`) — dejar que corra solo durante horas sin que tú revises nada entre medio es un riesgo innecesario, aunque el proyecto tenga la regla de dejar todo en pausa por defecto. Por eso: **un `/goal` por módulo, revisas lo que hizo, y recién ahí lanzas el siguiente.**

---

## Orden recomendado (según el estado actual en `CLAUDE.md`)

Ya completados: M0, M1 (con pendientes menores), M2, M3 (alcance acotado), M4, M5.

Lo que sigue, en este orden:

1. M6 — Segmentación
2. M7 — Copys con IA
3. M8 — Gestión creativa (imágenes)
4. Cierre de M3 — Anuncio + Creativo (necesita M7 y M8 listos)
5. M9 — Cumplimiento normativo
6. M10 — Publicación y monitoreo (completar lo que falta)
7. M11 — Reportería y dashboards
8. M12 — Administración, seguridad y QA (incluye revisión de buenas prácticas)
9. M13 — Despliegue y puesta en marcha (parcial — ver nota al final)

---

## 1. M6 — Segmentación

```
/goal En la página /campanas/nueva existe un paso de segmentación con modo "manual" (ubicación por comuna/región, edad, género, intereses) y modo "automático" (Advantage+ Audience). El AdSet se crea en Meta con el campo targeting correspondiente según el modo elegido. El modelo AdSet tiene un campo specialAdCategoryActive que se activa automáticamente solo si el público seleccionado incluye EE. UU., Canadá o algún país europeo (ver sección 3 del plan de trabajo y MODELO_DATOS.md). No se modifican los módulos M3, M4 o M5 ya cerrados, salvo para conectar la segmentación. npm run build pasa sin errores.
```

## 2. M7 — Generación de copys con IA

```
/goal Al crear o editar una campaña existe un botón "Generar copy con IA" que llama a la API de Claude (Anthropic) usando los datos de la propiedad (M4) y el tipo de campaña elegido (M5: landing, formulario, WhatsApp o Instagram/Messenger). El resultado incluye texto principal, título y descripción respetando los límites de caracteres de Meta (~125 caracteres visibles en texto principal, 27-40 en título). El usuario puede generar variantes adicionales y editar el texto manualmente antes de guardar. La clave de la API de Claude se lee desde variable de entorno, nunca hardcodeada. npm run build pasa sin errores.
```

## 3. M8 — Gestión creativa (imágenes)

```
/goal Cada propiedad en /propiedades permite subir, ver y eliminar fotos, almacenadas en un servicio de almacenamiento de archivos (proponer uno simple y explicarme el porqué antes de instalar nada, ej. Vercel Blob o Cloudflare R2, considerando que hoy no hay ninguno configurado). En el wizard de campaña se puede elegir una foto de la propiedad como creativo del anuncio, con una previsualización simple. Se valida el peso del archivo antes de subir. npm run build pasa sin errores.
```

## 4. Cierre de M3 — Anuncio + Creativo

*(Ejecutar recién después de que M7 y M8 estén cerrados.)*

```
/goal Al publicar una campaña, además de crear Campaña y AdSet en Meta (ya funciona desde M3), ahora también se crea el objeto Ad con su AdCreative usando el copy generado en M7 y la imagen elegida en M8. El anuncio queda en estado PAUSED igual que el resto. Se puede confirmar en Meta Ads Manager que el anuncio existe con imagen y texto reales, no vacío. npm run build pasa sin errores.
```

## 5. M9 — Cumplimiento normativo

```
/goal Antes de publicar cualquier campaña existe una validación automática (checklist pre-publicación) que revisa: cumplimiento de Ad Standards de Meta, activación de Special Ad Category solo si corresponde según M6, y bloqueo si el copy generado en M7 contiene afirmaciones no verificables. Existe una página de política de privacidad accesible desde la app (borrador de texto explicando qué datos de leads se recolectan y para qué — dejar marcado como "borrador, pendiente de revisión legal de Paul", no presentarlo como texto legal definitivo). npm run build pasa sin errores.
```

## 6. M10 — Publicación y monitoreo (completar lo pendiente)

```
/goal El estado de cada campaña (activa, pausada, en revisión, rechazada) se sincroniza consultando la Marketing API, con un botón para refrescar manualmente el estado. Si Meta rechaza un anuncio, se muestra el motivo que informa la API. Las llamadas a la Marketing API manejan rate limiting: si la API responde error de límite, se reintenta con backoff en vez de fallar de inmediato. npm run build pasa sin errores.
```

## 7. M11 — Reportería y dashboards

```
/goal Existe una página /reportes que muestra, usando la Insights API de Meta, alcance, clics, costo por resultado y leads generados por campaña y por propiedad. Existe un botón para exportar el reporte visible a PDF o Excel. npm run build pasa sin errores.
```

## 8. M12 — Administración, seguridad y QA (incluye revisión de buenas prácticas)

```
/goal Todas las rutas de API verifican que el usuario autenticado solo pueda ver o modificar datos de su propia organización (organizationId) — revisar cada ruta en app/api existente, no solo las nuevas. Existe registro de auditoría (AuditLog) para: conexión/desconexión de cuenta de Meta, publicación de campañas, y cambios de rol de usuario. Existe un informe en docs/REVISION_CODIGO.md fechado hoy que audita: (1) aislamiento multi-tenant en cada endpoint, (2) manejo de errores y validación de inputs, (3) ausencia de secretos hardcodeados o logueados en texto plano, (4) tipado estricto de TypeScript sin "any" injustificado, (5) que toda campaña se siga creando en estado PAUSED por defecto. Si el informe encuentra problemas críticos, se corrigen en el mismo turno. npm run build y npm run lint pasan sin errores al final.
```

**Este mismo `/goal` de revisión de buenas prácticas lo puedes volver a lanzar en cualquier momento**, no solo en M12 — es una buena costumbre correrlo cada vez que sientas que se acumuló código sin revisar.

## 9. M13 — Despliegue (parcial)

Este módulo depende de decisiones tuyas (qué proveedor de hosting, dominio, etc. — ver checklist manual más abajo), así que el `/goal` acá solo cubre lo que sí es código:

```
/goal El proyecto tiene un Dockerfile funcional, un archivo .env.example documentando todas las variables de entorno necesarias (sin valores reales), y un manual de usuario básico en docs/MANUAL_USUARIO.md explicando cómo una inmobiliaria conecta su cuenta y crea su primera campaña. npm run build pasa sin errores.
```

---

## Lo que Claude Code NO puede hacer — pendiente manual para ti

Estas acciones requieren tus cuentas, tu firma, tu tarjeta o tu criterio de negocio. Ningún prompt se las puede delegar:

1. **Conectar WhatsApp Business e Instagram profesional** al Business Manager (pendiente de M5) — se hace desde Meta Business Suite con el número/cuenta real de la inmobiliaria.
2. **Verificación de dominio + instalar Meta Pixel/Conversions API** en una landing page real (M5/M9) — necesita que exista un sitio real y acceso a su administración.
3. **Meta App Review (Advanced Access)** — formulario, video de demo, política de privacidad publicada en una URL real, y esperar la revisión de Meta (semanas). Requiere decisiones que solo tú puedes tomar como responsable del negocio.
4. **Migrar a System User Access Token** (pendiente de M1) — Claude Code puede programar el cambio, pero crear el System User y sus permisos en el Business Manager es un paso manual en el panel de Meta.
5. **Medio de pago y presupuesto real** de la cuenta publicitaria `act_1039252130669863` — ni yo ni Claude Code debemos tocar esto.
6. **Decisión de pasar una campaña de PAUSED a ACTIVA** — siempre debe ser una confirmación tuya explícita, nunca automática (regla ya en `CLAUDE.md`).
7. **Contratar el hosting de producción** (AWS, Railway, Render, Vercel, etc.) y su medio de pago.
8. **Comprar y configurar el dominio real** de producción.
9. **Revisión legal real** de la política de privacidad y términos de uso (Ley 21.719, Ley del Consumidor) — lo que se genera es un borrador, no asesoría legal.
10. **Onboarding comercial de cada inmobiliaria cliente** (conseguir que acepten conectar su Business Manager) — es un tema comercial, no técnico.

Te sugiero ir tachando esta lista en paralelo a los `/goal` de arriba, no al final.
