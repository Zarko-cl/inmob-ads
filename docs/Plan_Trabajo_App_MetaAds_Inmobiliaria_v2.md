# PLAN DE TRABAJO

## Aplicativo de Gestión de Campañas Meta Ads para el Sector Inmobiliario — Mercado Chile

Preparado para Paul · Versión 2 — 11 de agosto de 2026

> Nota: este archivo es una copia en Markdown de `Plan_Trabajo_App_MetaAds_Inmobiliaria_v2.docx`, creada para que las herramientas de Claude Code puedan leerlo directamente (el `.docx` es binario y no se puede parsear con las herramientas de lectura de archivos). Mantener ambos sincronizados si se edita el plan.

## 1. Resumen ejecutivo

Este documento define el plan de trabajo modular para construir una aplicación que permita a empresas inmobiliarias en Chile conectar su cuenta publicitaria de Meta, crear y gestionar campañas de Facebook e Instagram Ads, elegir el tipo de campaña (landing page propia, sitio web, formulario instantáneo, mensaje directo por WhatsApp o Instagram/Messenger), definir la segmentación de forma manual o automática, y generar copys persuasivos orientados a incentivar visitas a propiedades. El plan se apoya en la documentación oficial de Meta (Marketing API, Business Login, Ad Standards, Click-to-WhatsApp, especificaciones creativas) y en la normativa chilena aplicable, y está organizado en módulos secuenciales, cada uno con objetivo, funcionalidades, entregables y dependencias, para gestionarse y aprobarse uno a uno.

Respecto de la versión anterior de este plan, se corrigió un punto clave: la Special Ad Category de Meta para vivienda (que en EE. UU., Canadá y algunos países de Europa obliga a restringir edad, género, código postal e intereses) no aplica a campañas dirigidas a Chile. Esto se confirmó directamente en la ayuda oficial de Meta para empresas (ver sección 7). El aplicativo, por tanto, debe permitir segmentación completa por defecto para el mercado chileno, y solo activar esas restricciones si en el futuro una campaña llega a targetear EE. UU., Canadá o Europa.

## 2. Alcance del producto

- Conexión de cuentas publicitarias de empresas inmobiliarias vía Meta Business Login (OAuth), sin exponer credenciales del cliente a la app.
- Ficha de propiedades/listados (catálogo interno) que alimenta la creación de campañas, los creativos y la generación de copys.
- Creación de campañas completas (Campaña → Conjunto de anuncios → Anuncio) directamente desde el aplicativo, sin pasar por Meta Ads Manager.
- Selección del tipo de campaña / destino del clic: landing page propia (URL externa), sitio web del cliente, formulario instantáneo, Click-to-WhatsApp (CTWA) o Click-to-Instagram/Messenger.
- Segmentación configurable y completa para Chile (ubicación, edad, género, intereses, públicos personalizados y similares) o automática (Advantage+ Audience), con un motor que activa restricciones adicionales de Meta solo si la campaña targetea países donde la Special Ad Category es obligatoria.
- Generación de copys publicitarios persuasivos con IA, orientados al objetivo de negocio (agendar visita, contactar asesor, dejar datos), respetando los límites de caracteres de cada formato de Meta y la normativa chilena de publicidad.
- Publicación real de campañas, monitoreo de estado y reportería de resultados (alcance, clics, leads, costo por resultado).
- El pago de la inversión publicitaria (ad spend) lo asume cada inmobiliaria directamente con Meta a través del medio de pago cargado en su propio Business Manager; el aplicativo no procesa ni almacena datos de tarjetas ni mueve dinero por cuenta del cliente.

## 3. Consideraciones normativas — alcance geográfico (Chile)

La Special Ad Category de Meta para vivienda es una clasificación obligatoria solo cuando el anunciante está en, o dirige su campaña a, Estados Unidos, Canadá o ciertos países de Europa. Esto está confirmado en la ayuda oficial de Meta para empresas: "Si el anunciante está en Estados Unidos o se dirige a ese país, o si se dirige a Canadá y a ciertos países de Europa, las siguientes opciones de público no estarán disponibles o se limitarán...". Como este aplicativo gestiona campañas dirigidas a Chile, esa restricción no aplica por defecto, y el diseño debe reflejarlo:

- Segmentación completa disponible para campañas en Chile: edad, género, ubicación (radio libre, no forzado a un mínimo), código postal/comuna, intereses y comportamientos detallados, públicos personalizados y "lookalike".
- El copy no está sujeto al filtro obligatorio de lenguaje de Special Ad Category (por ejemplo "comunidad exclusiva") que exige Meta en EE. UU./Canadá/Europa, aunque de todas formas debe evitar afirmaciones engañosas por buenas prácticas y por la Ley del Consumidor chilena (ver M9).
- El motor de segmentación (M6) debe, de todas formas, detectar automáticamente si una campaña llega a incluir como público objetivo a EE. UU., Canadá o algún país europeo (por ejemplo, campañas para chilenos en el extranjero o inversionistas internacionales) y, solo en ese caso, activar las restricciones de Special Ad Category para esa campaña específica.
- Se debe seguir aplicando el resto de las Normas de Publicidad de Meta (Ad Standards), que sí son universales y no están ligadas a Special Ad Category: contenido prohibido, prácticas engañosas, requisitos de destino del anuncio, etc.

## 4. Mapa de módulos (resumen secuencial)

Los módulos se ejecutan en el orden indicado; cada uno depende de que el/los anteriores estén validados. Los módulos 6, 7 y 8 pueden trabajarse en paralelo una vez cerrados los módulos 4 y 5.

| Módulo | Nombre | Contenido principal |
|---|---|---|
| M0 | Descubrimiento y arquitectura | Definición técnica, cuenta developer de Meta, stack, modelo de datos |
| M1 | Conexión de cuentas (Auth) | Login OAuth con Meta Business, permisos, App Review, tokens |
| M2 | Gestión multi-cliente | Multi-tenant, cuentas publicitarias, roles y permisos por inmobiliaria |
| M3 | Motor de campañas | Creación de Campaña > Conjunto de anuncios > Anuncio vía Marketing API |
| M4 | Gestión de propiedades y catálogo | Ficha de propiedad, fotos, precio y estado; fuente de datos para campañas, creativos y copys |
| M5 | Tipos de campaña y destino | Landing page/sitio web (con Pixel y verificación de dominio), formulario instantáneo, WhatsApp (CTWA), Instagram/Messenger |
| M6 | Segmentación | Manual (completa para Chile) y automática (Advantage+), con activación condicional de reglas de Meta si se targetea EE. UU./Canadá/Europa |
| M7 | Generación de copys con IA | Copys persuasivos orientados a visitas, por formato y objetivo |
| M8 | Gestión creativa | Carga y validación de imágenes/video según specs de Meta, previsualización |
| M9 | Cumplimiento normativo | Meta Ad Standards, Ley 21.719 de protección de datos y Ley del Consumidor (Chile) |
| M10 | Publicación y monitoreo | Publicación real, estados, Insights API, alertas de rendimiento |
| M11 | Reportería y dashboards | Métricas por campaña/inmobiliaria, ROI, leads/visitas generadas |
| M12 | Administración, seguridad y QA | Roles internos, auditoría, pruebas con cuenta sandbox, hardening, rate-limit handling |
| M13 | Despliegue y puesta en marcha | Ambiente productivo, capacitación, documentación, soporte post-lanzamiento |

## 5. Detalle de módulos

### M0. Descubrimiento y arquitectura técnica

**Objetivo:** Definir el stack tecnológico, el modelo de datos y la infraestructura sobre la cual se construirán todos los módulos siguientes.

**Duración estimada:** 1–2 semanas
**Depende de:** Ninguna (punto de partida)

**Funcionalidades clave**
- Definición de arquitectura (backend, frontend, base de datos, colas de trabajo para llamadas asíncronas a Meta).
- Registro de la app en Meta for Developers, configuración del producto Marketing API y creación de una cuenta publicitaria de prueba (sandbox) para desarrollo sin gastar presupuesto real.
- Definición del modelo de datos: empresas inmobiliarias, usuarios, cuentas publicitarias vinculadas, campañas, propiedades/listados.
- Estrategia de manejo de tokens, rate limiting (Business Use Case) y colas de reintento.

**Entregables**
- Documento de arquitectura técnica.
- App creada en Meta for Developers con producto Marketing API habilitado y cuenta sandbox de pruebas.
- Esquema de base de datos inicial.

**Documentación / referencias a aplicar**
- Meta for Developers — Marketing API (developers.facebook.com/documentation/ads-commerce/marketing-api).
- Graph API — estructura Node/Edge/Field y jerarquía Business Manager → Cuenta publicitaria → Campaña → Conjunto de anuncios → Anuncio → Creativo.

### M1. Conexión de cuentas (Autenticación y OAuth)

**Objetivo:** Permitir que una empresa inmobiliaria conecte su cuenta publicitaria de Meta al aplicativo de forma segura, sin manejar contraseñas ni medios de pago.

**Duración estimada:** 2–3 semanas
**Depende de:** M0

**Funcionalidades clave**
- Flujo de login con Facebook Login for Business (OAuth) para vincular Business Manager y cuenta publicitaria.
- Solicitud de permisos (scopes) mínimos necesarios: `ads_management`, `business_management`, `pages_show_list`, y `whatsapp_business_messaging` si aplica CTWA.
- Selección, dentro del flujo, de qué cuenta publicitaria y qué Página/número de WhatsApp usar cuando el cliente tiene varias.
- Manejo de tokens: uso de System User Access Tokens de larga duración para automatizaciones en segundo plano, y refresco/expiración.
- Proceso de Meta App Review para poder operar sobre cuentas de terceros (obligatorio antes de salir a producción con clientes reales).
- Aclaración de modelo de facturación: el gasto publicitario se cobra directamente al medio de pago que la inmobiliaria ya tiene cargado en su Business Manager; el aplicativo nunca captura ni almacena datos de tarjetas.

**Entregables**
- Flujo de conexión de cuenta funcional en ambiente de pruebas.
- Solicitud de App Review enviada/aprobada por Meta para los permisos avanzados.
- Almacenamiento seguro y cifrado de tokens por cliente.

**Documentación / referencias a aplicar**
- Facebook Login for Business (developers.facebook.com/documentation/facebook-login/facebook-login-for-business).
- Access Tokens for Meta Technologies (User Access Token vs System User Access Token).
- Requisitos de Meta App Review para `business_management` y `ads_management`.

### M2. Gestión multi-cliente (multi-tenant)

**Objetivo:** Permitir que el aplicativo administre múltiples empresas inmobiliarias, cada una con su propia cuenta publicitaria, usuarios y permisos.

**Duración estimada:** 2 semanas
**Depende de:** M1

**Funcionalidades clave**
- Modelo multi-tenant: cada inmobiliaria ve únicamente sus propias campañas y datos.
- Roles internos (administrador de agencia, administrador de la inmobiliaria, editor, solo lectura).
- Panel de alta de nuevas empresas y reconexión de cuentas si el token se invalida.

**Entregables**
- Panel de administración de clientes/cuentas.
- Sistema de roles y permisos.

**Documentación / referencias a aplicar**
- Business Manager — jerarquía y asignación de activos (cuentas publicitarias, Páginas) por negocio.

### M3. Motor de creación de campañas

**Objetivo:** Construir el flujo central que traduce lo que el usuario configura en el aplicativo a los objetos que exige la Marketing API de Meta.

**Duración estimada:** 3–4 semanas
**Depende de:** M1, M2

**Funcionalidades clave**
- Creación en cascada de Campaña → Conjunto de anuncios → Anuncio → Creativo, respetando la jerarquía obligatoria de la API.
- Selector de objetivo de campaña (mapeado a los objetivos ODAX de Meta: Tráfico, Interacción, Clientes potenciales/Leads, Ventas, entre otros) según lo que el usuario quiera lograr (visitas, contactos, leads).
- Configuración de presupuesto (diario o total) y calendario de la campaña.
- Guardado de campañas como borrador antes de publicar, y publicación efectiva vía API.
- Manejo de errores de la API (rechazos, validaciones) con mensajes entendibles para el usuario.

**Entregables**
- Wizard de creación de campaña funcional de punta a punta contra la cuenta sandbox de Meta.
- Servicio backend de integración con la Marketing API (crear/editar/pausar/eliminar campañas).

**Documentación / referencias a aplicar**
- Marketing API — Campaign, Ad Set, Ad, Ad Creative (campos y jerarquía).
- Guía de objetivos de campaña (ODAX): Awareness, Traffic, Engagement, Leads, App Promotion, Sales.

### M4. Gestión de propiedades y catálogo

**Objetivo:** Centralizar la información de cada propiedad (ficha, fotos, precio, estado) como fuente única de datos para armar campañas, creativos y copys, evitando cargar todo a mano cada vez.

**Duración estimada:** 2–3 semanas
**Depende de:** M2

**Funcionalidades clave**
- Alta y edición de propiedades: tipo, ubicación, precio, superficie, características, estado (disponible/reservada/vendida), fotos y datos de contacto del asesor a cargo.
- Importación masiva de propiedades (CSV/Excel) o integración futura con portales inmobiliarios y CRM ya usados por la inmobiliaria.
- Vínculo directo entre una propiedad y las campañas creadas para ella, para poder reportar por propiedad y no solo por campaña.
- Pausa automática sugerida de campañas cuando una propiedad cambia de estado a "vendida" o "reservada".

**Entregables**
- Módulo de catálogo de propiedades con carga manual e importación masiva.
- Vínculo propiedad–campaña en el modelo de datos.

**Documentación / referencias a aplicar**
- Meta Commerce Manager / Catalog Ads (referencia para una futura extensión hacia anuncios dinámicos de catálogo, fuera del alcance inicial).

### M5. Tipos de campaña y destino del clic

**Objetivo:** Permitir que el usuario elija hacia dónde lleva el anuncio: landing page propia, sitio web, formulario instantáneo, WhatsApp o Instagram/Messenger.

**Duración estimada:** 3–4 semanas
**Depende de:** M3, M4

**Funcionalidades clave**
- Opción "Landing page / sitio web": el anuncio dirige a una URL (landing page de la propiedad o página web de la inmobiliaria), usando objetivo Tráfico o Leads con formulario propio en el sitio.
- Verificación de dominio en Meta Business Manager e instalación de Meta Pixel / Conversions API en la landing o sitio del cliente, para medir y optimizar por visitas/leads reales y no solo por clics.
- Opción "Formulario instantáneo (Instant Forms)": captura de leads dentro de la misma plataforma de Meta sin salir a un sitio externo, útil para campañas de alto volumen con menor fricción.
- Opción "WhatsApp": campañas Click-to-WhatsApp (CTWA) que abren un chat de WhatsApp con mensaje prellenado, configurando `destination_type = WHATSAPP` en el conjunto de anuncios y vinculando el número de WhatsApp Business del cliente (WhatsApp Business Platform / Cloud API), incluyendo configuración de mensaje de bienvenida y respeto de la ventana de 24 horas para el reinicio de conversación.
- Opción "Instagram / Messenger": campañas de clic a mensaje directo en Instagram o Messenger como alternativa a WhatsApp.
- Validación de requisitos previos por tipo (número de WhatsApp Business conectado, Página de Instagram vinculada, dominio verificado si aplica).

**Entregables**
- Selector de "tipo de campaña" en el wizard, con las 4 variantes operativas.
- Integración funcional de Click-to-WhatsApp y Click-to-Instagram/Messenger.
- Flujo de verificación de dominio e instalación de Pixel/Conversions API para campañas a landing/sitio web.

**Documentación / referencias a aplicar**
- Click to WhatsApp Ads — Marketing API (developers.facebook.com/docs/marketing-api/ad-creative/messaging-ads/click-to-whatsapp).
- Parámetro `destination_type` en la creación de conjuntos de anuncios (`WHATSAPP`, `MESSENGER`, `INSTAGRAM_DIRECT`, `WEBSITE`, `ON_AD`).
- Documentación de Lead Ads / Instant Forms.
- Domain Verification en Meta Business Manager y Meta Pixel / Conversions API.
- WhatsApp Business Platform (Cloud API) — plantillas de mensaje y ventana de 24 horas.

### M6. Segmentación (manual y automática)

**Objetivo:** Dar control de audiencia completo al usuario para el mercado chileno, activando restricciones de Meta solo cuando una campaña efectivamente targetea EE. UU., Canadá o Europa.

**Duración estimada:** 3 semanas
**Depende de:** M3, M4

**Funcionalidades clave**
- Modo manual: ubicación (radio libre o por comuna/región), edad, género, intereses y comportamientos, sin las restricciones de Special Ad Category, ya que no aplican a Chile.
- Modo automático: uso de Advantage+ Audience para que el algoritmo de Meta amplíe o ajuste la audiencia en función del objetivo de conversión elegido (ej. leads o visitas agendadas).
- Públicos personalizados y "lookalike" habilitados (por ejemplo, a partir de leads previos o visitantes del sitio vía Pixel/CAPI de M5).
- Detector de país objetivo: si el usuario agrega EE. UU., Canadá o un país europeo como parte del público (caso de campañas para compradores en el extranjero), el sistema activa automáticamente el modo Special Ad Category solo para esa campaña y oculta/bloquea los parámetros no permitidos en esos mercados.
- Guardado de audiencias reutilizables por tipo de propiedad o zona.

**Entregables**
- Formulario de segmentación con modo manual/automático y segmentación completa por defecto.
- Motor de detección de país objetivo con activación condicional de reglas de Special Ad Category.

**Documentación / referencias a aplicar**
- Cómo elegir una categoría de anuncio especial — Meta Business Help Center (alcance geográfico: EE. UU., Canadá y ciertos países de Europa).
- Advantage+ Audience — documentación de targeting automático para objetivos de conversión.
- Targeting Search API (estructura del campo `targeting`).

### M7. Generación de copys persuasivos con IA

**Objetivo:** Generar automáticamente textos publicitarios orientados a incentivar la visita/contacto, ajustados a los límites y formatos de Meta y a buenas prácticas de publicidad honesta.

**Duración estimada:** 3–4 semanas
**Depende de:** M4, M5

**Funcionalidades clave**
- Generación de texto principal, título y descripción a partir de los datos de la propiedad cargados en M4 (tipo, ubicación, precio, características, llamada a la acción deseada).
- Variantes de copy según el tipo de campaña elegido en M5 (ej. copy que invita a escribir por WhatsApp vs. copy que invita a agendar visita en landing).
- Respeto de límites de Meta: ~125 caracteres visibles en texto principal (hasta 2200 totales), títulos recomendados de 27–40 caracteres (hasta 255 aceptados por API), descripciones de ~30 caracteres.
- Generación de múltiples variantes (A/B) para pruebas dentro de un mismo conjunto de anuncios.
- Filtro de buenas prácticas: evita afirmaciones engañosas o no verificables (alineado con la Ley del Consumidor chilena, M9), y activa el filtro de lenguaje excluyente de Special Ad Category solo si la campaña targetea EE. UU./Canadá/Europa (M6).
- Edición manual del copy generado antes de publicar.

**Entregables**
- Servicio de generación de copy integrado al wizard de campaña.
- Librería de prompts y reglas de estilo persuasivo para inmobiliaria.
- Filtro de buenas prácticas publicitarias con activación condicional del filtro de Special Ad Category.

**Documentación / referencias a aplicar**
- Especificaciones de texto por formato y placement (Feed, Reels, Stories) — límites de caracteres 2026.
- Meta Ad Standards (normas generales de contenido, aplican en todo mercado).

### M8. Gestión creativa (imágenes y video)

**Objetivo:** Permitir cargar y validar los recursos visuales del anuncio según las especificaciones técnicas de cada placement de Meta.

**Duración estimada:** 2 semanas
**Depende de:** M4

**Funcionalidades clave**
- Carga de imágenes/video por propiedad (reutilizando el catálogo de M4), con validación de proporciones y peso según placement (Feed, Reels, Stories, Marketplace).
- Previsualización del anuncio tal como se vería en cada ubicación antes de publicar.
- Banco de creatividades reutilizables por inmobiliaria.

**Entregables**
- Módulo de carga y validación de creatividades.
- Previsualización multi-formato.

**Documentación / referencias a aplicar**
- Especificaciones de tamaños y formatos de anuncio de Meta (Feed, Reels, Stories) 2026.

### M9. Cumplimiento normativo (Meta + Chile)

**Objetivo:** Evitar rechazos de anuncios y suspensiones de cuenta, y asegurar el cumplimiento de la normativa chilena relevante para el manejo de datos de leads y publicidad inmobiliaria.

**Duración estimada:** 2–3 semanas
**Depende de:** M6, M7, M8

**Funcionalidades clave**
- Checklist automático previo a publicación contra las Normas de Publicidad de Meta (Ad Standards): contenido prohibido, requisitos de destino del anuncio, y activación de reglas de Special Ad Category solo si corresponde según M6.
- Política de privacidad y tratamiento de datos de leads alineada a la Ley N.° 21.719 sobre protección de datos personales (Chile), incluyendo consentimiento para el uso de datos capturados vía formularios/WhatsApp y definición de plazos de retención.
- Revisión de que los copys y landing pages no incurran en publicidad engañosa conforme a la Ley N.° 19.496 de protección al consumidor (SERNAC).
- Alertas al usuario explicando por qué algo no cumple, antes de enviarlo a Meta.
- Registro de auditoría de cada campaña publicada (para trazabilidad ante reclamos, fiscalizaciones o revisiones de Meta).

**Entregables**
- Motor de validación de cumplimiento pre-publicación (Meta + normativa chilena).
- Política de privacidad y tratamiento de datos de leads, alineada a la Ley 21.719.
- Bitácora de auditoría por campaña.

**Documentación / referencias a aplicar**
- Meta Ad Standards / Advertising Policies (transparency.meta.com/policies/ad-standards).
- Cómo elegir una categoría de anuncio especial — Meta Business Help Center.
- Ley N.° 21.719 sobre protección de datos personales (Chile).
- Ley N.° 19.496 sobre protección de los derechos de los consumidores (Chile / SERNAC).

### M10. Publicación y monitoreo

**Objetivo:** Publicar campañas reales en Meta y mantener sincronizado su estado dentro del aplicativo.

**Duración estimada:** 2–3 semanas
**Depende de:** M9

**Funcionalidades clave**
- Publicación efectiva de campaña/conjunto/anuncio vía Marketing API una vez pasada la validación de M9.
- Sincronización de estado (activa, pausada, en revisión, rechazada) y motivo de rechazo si Meta lo informa.
- Manejo de límites de uso de la API (Business Use Case) con colas y reintentos para no ser bloqueados por throttling.
- Notificaciones al usuario ante cambios de estado relevantes.

**Entregables**
- Publicación real funcionando en cuenta sandbox y luego en cuenta productiva.
- Sistema de sincronización de estados con manejo de rate limiting.

**Documentación / referencias a aplicar**
- Rate Limiting — Marketing API (`X-Business-Use-Case-Usage`, límites por tier de acceso).
- Batching de requests para reducir consumo de cuota.

### M11. Reportería y dashboards

**Objetivo:** Mostrar el desempeño de las campañas en métricas relevantes para el negocio inmobiliario, no solo métricas publicitarias genéricas.

**Duración estimada:** 2–3 semanas
**Depende de:** M10

**Funcionalidades clave**
- Dashboard por campaña, por propiedad (usando el vínculo de M4) y por inmobiliaria: alcance, clics, costo por resultado, leads/contactos generados, mensajes de WhatsApp iniciados.
- Métrica de "visitas incentivadas" (proxy: clics a WhatsApp/formulario/landing con intención de agendar, y conversiones reales medidas vía Pixel/CAPI de M5).
- Exportación de reportes (PDF/Excel) por periodo y por propiedad.

**Entregables**
- Dashboard de resultados integrado a la Insights API de Meta.
- Exportación de reportes periódicos.

**Documentación / referencias a aplicar**
- Marketing API — Ads Insights (métricas de alcance, clics, resultados, costo por resultado).

### M12. Administración, seguridad y QA

**Objetivo:** Asegurar que el sistema sea seguro, auditable y esté probado antes de escalarlo a más clientes.

**Duración estimada:** 2–3 semanas
**Depende de:** M10, M11

**Funcionalidades clave**
- Cifrado de tokens y datos sensibles, control de acceso por rol, registro de auditoría de acciones administrativas.
- Pruebas funcionales de extremo a extremo sobre la cuenta sandbox (conexión de cuenta → creación → publicación → reporte) antes de tocar presupuesto real de un cliente.
- Pruebas de manejo de errores de la API de Meta (tokens expirados, rechazos, rate limiting).
- Plan de respaldo y recuperación de datos (backups de campañas, catálogos y leads).

**Entregables**
- Informe de pruebas QA.
- Revisión de seguridad y manejo de credenciales.
- Plan de backup y recuperación documentado.

**Documentación / referencias a aplicar**
- Buenas prácticas de seguridad de Meta for Developers para apps con acceso a Marketing API.

### M13. Despliegue y puesta en marcha

**Objetivo:** Llevar el aplicativo a producción con clientes reales y dejar el soporte operativo definido.

**Duración estimada:** 1–2 semanas
**Depende de:** M12

**Funcionalidades clave**
- Paso de modo desarrollo a Advanced Access en Meta (post App Review) para operar cuentas de clientes reales.
- Ambiente productivo, monitoreo de errores y disponibilidad.
- Documentación de usuario y capacitación al equipo comercial/soporte de la inmobiliaria.
- Evaluación de postulación al programa Meta Business Partner a mediano plazo, para acceder a soporte prioritario y mayores cuotas de API una vez validado el producto con clientes reales.

**Entregables**
- Aplicativo en producción.
- Manual de usuario y plan de soporte post-lanzamiento.

**Documentación / referencias a aplicar**
- Requisitos de Meta para pasar de Standard/Development Access a Advanced Access.

## 6. Consideraciones técnicas transversales

- Rate limiting: la Marketing API limita por cuenta publicitaria y Business Use Case; hay que monitorear el header `X-Business-Use-Case-Usage` y actuar entre 70–80% de uso, no al llegar al tope.
- Tokens: preferir System User Access Tokens (no expiran por tiempo) sobre User Access Tokens para procesos automáticos en segundo plano.
- App Review de Meta es un hito crítico de cronograma: sin la aprobación de `business_management` y `ads_management` no se puede operar cuentas de clientes fuera del Business Manager propio; conviene iniciarlo en paralelo a M1–M3.
- El motor de segmentación y de copys (M6, M7) debe diseñarse con segmentación completa por defecto para Chile, y con detección automática de país objetivo para activar las restricciones de Meta solo si en algún momento se targetea EE. UU., Canadá o Europa.
- Todo el desarrollo y las pruebas de M0 a M12 deben correr contra una cuenta publicitaria sandbox, sin usar presupuesto ni cuentas reales de clientes hasta el módulo de despliegue (M13).
- El aplicativo no debe, bajo ninguna circunstancia, capturar ni almacenar datos de tarjetas o medios de pago: el gasto publicitario siempre se realiza a través del medio de pago que la inmobiliaria ya tiene configurado en su propio Business Manager.

## 7. Fuentes oficiales consultadas

- Marketing API — Meta for Developers: developers.facebook.com/documentation/ads-commerce/marketing-api
- Facebook Login for Business: developers.facebook.com/documentation/facebook-login/facebook-login-for-business
- Access Tokens for Meta Technologies: developers.facebook.com/documentation/facebook-login/guides/access-tokens
- Click to WhatsApp Ads: developers.facebook.com/docs/marketing-api/ad-creative/messaging-ads/click-to-whatsapp
- Rate Limiting — Marketing API: developers.facebook.com/docs/marketing-api/overview/rate-limiting
- Meta Ad Standards / Transparency Center: transparency.meta.com/policies/ad-standards
- Cómo elegir una categoría de anuncio especial — Meta Business Help Center (confirma que las restricciones de Special Ad Category aplican solo a EE. UU., Canadá y ciertos países de Europa): business.facebook.com/help/298000447747885

## 8. Cambios realizados en esta versión

- Se corrigió el alcance de la Special Ad Category: no aplica a Chile por defecto; el aplicativo ahora permite segmentación completa y solo restringe si la campaña targetea EE. UU., Canadá o Europa (secciones 3, M6 y M7).
- Se agregó el módulo M4 "Gestión de propiedades y catálogo", identificado como una pieza central que faltaba: sin una ficha de propiedad estructurada, los módulos de campañas, creativos y copys no tienen de dónde tomar los datos.
- Se agregó verificación de dominio y Meta Pixel/Conversions API al módulo de tipos de campaña (M5), para poder medir conversiones reales en landing pages y sitios web, no solo clics.
- Se precisó el uso de WhatsApp Business Platform (Cloud API), plantillas de mensaje y ventana de 24 horas dentro de M5.
- Se amplió el módulo de cumplimiento (ahora M9) para cubrir normativa chilena: Ley 21.719 de protección de datos personales y Ley del Consumidor (SERNAC), además de las Normas de Publicidad de Meta.
- Se aclaró el modelo de facturación: el aplicativo no maneja pagos ni tarjetas; el gasto se carga directamente en el Business Manager de cada inmobiliaria (M1 y sección 6).
- Se incorporó el uso de una cuenta publicitaria sandbox para todo el desarrollo y pruebas (M0, M3, M12), evitando usar presupuesto real hasta el despliegue.
- Se añadió la evaluación futura del programa Meta Business Partner como acelerador de soporte y cuotas de API (M13).

## 9. Próximos pasos

Se sugiere aprobar este plan y comenzar por el Módulo 0 (arquitectura) y el Módulo 1 (conexión de cuentas) en paralelo con el inicio del proceso de App Review de Meta, dado que este último puede tomar varias semanas y es bloqueante para operar cuentas de clientes reales. En paralelo puede avanzarse en el Módulo 4 (catálogo de propiedades), ya que no depende de la integración con Meta.
