# Política de privacidad y tratamiento de datos personales — PLANTILLA

**Módulo:** M9 — Cumplimiento normativo
**Estado:** Borrador base, **pendiente de revisión legal**

> ⚠️ **Léelo antes de usar esto.** Este documento es un punto de partida redactado a
> partir de lo que exige la Ley N.° 21.719 sobre protección de datos personales de
> Chile, para que no partas de una hoja en blanco. **No es asesoría legal y no
> garantiza cumplimiento.** Antes de publicarlo, hazlo revisar por un abogado con
> experiencia en protección de datos: los detalles dependen de qué datos recolecta
> realmente cada inmobiliaria, con qué proveedores los comparte y cómo los usa.
>
> Los textos entre `[corchetes]` son los que hay que completar en cada caso.

---

## Por qué hace falta

Cuando una campaña usa **formulario instantáneo, WhatsApp o Instagram/Messenger**,
la persona interesada entrega datos personales (nombre, teléfono, correo). La Ley
21.719 exige, entre otras cosas:

- Informar **quién** trata los datos y cómo contactarlo.
- Informar **para qué** se usan (finalidad) y con qué **base legal**.
- Informar **por cuánto tiempo** se conservan.
- Permitir ejercer los derechos de **acceso, rectificación, cancelación y oposición**.

Por eso el aplicativo **bloquea la publicación** de campañas que captan datos si la
inmobiliaria no tiene una política de privacidad registrada (ver
`lib/cumplimiento.ts`, código `SIN_POLITICA_PRIVACIDAD`).

---

## Plantilla

### Política de privacidad de [NOMBRE DE LA INMOBILIARIA]

**Última actualización:** [FECHA]

#### 1. Responsable del tratamiento

[NOMBRE DE LA INMOBILIARIA], RUT [RUT], con domicilio en [DIRECCIÓN], es responsable
del tratamiento de los datos personales que se recopilan a través de nuestros
anuncios, formularios y canales de contacto.

Contacto para materias de datos personales: [EMAIL DE CONTACTO].

#### 2. Qué datos recopilamos

Cuando respondes a uno de nuestros anuncios o nos escribes, podemos recopilar:

- Nombre y apellido
- Número de teléfono
- Correo electrónico
- La propiedad por la que consultas y el contenido de tu consulta
- Datos técnicos de navegación si visitas nuestro sitio (ver sección 7)

No solicitamos datos sensibles. Si nos los envías espontáneamente, no los usaremos
para ningún fin y los eliminaremos.

#### 3. Para qué usamos tus datos

- Contactarte para responder tu consulta sobre una propiedad.
- Coordinar visitas a la propiedad y hacer seguimiento comercial.
- [Si aplica] Enviarte información sobre otras propiedades similares, **solo si nos
  diste tu consentimiento para ello**.

No usamos tus datos para fines distintos a los informados sin pedirte autorización.

#### 4. Base legal

Tratamos tus datos sobre la base de tu **consentimiento**, que entregas al enviarnos
voluntariamente tu información a través del formulario o del canal de mensajería, y
para la ejecución de medidas precontractuales solicitadas por ti.

Puedes retirar tu consentimiento en cualquier momento escribiendo a
[EMAIL DE CONTACTO]. Retirarlo no afecta la licitud del tratamiento anterior.

#### 5. Por cuánto tiempo los conservamos

Conservamos tus datos por **[N] meses** desde el último contacto, plazo tras el cual
se eliminan o anonimizan, salvo que la ley exija conservarlos por más tiempo.

> Este plazo debe coincidir con el configurado en el aplicativo
> (Administración → Inmobiliarias → Cumplimiento).

#### 6. Con quién los compartimos

- **Meta Platforms, Inc.**, cuando el contacto se origina en un anuncio de Facebook
  o Instagram, conforme a sus propias políticas.
- [Proveedores tecnológicos que uses: hosting, CRM, correo. Nómbralos.]

No vendemos ni cedemos tus datos a terceros con fines comerciales.

#### 7. Cookies y tecnologías de medición

[Si tienes Meta Pixel o Conversions API instalados, decláralo acá: qué miden, con
qué finalidad y cómo se pueden rechazar. Si no los tienes, elimina esta sección.]

#### 8. Tus derechos

Puedes ejercer en cualquier momento tus derechos de acceso, rectificación,
cancelación (supresión), oposición y portabilidad de tus datos, escribiendo a
[EMAIL DE CONTACTO]. Responderemos en el plazo que establece la ley.

Si consideras que no hemos respetado tus derechos, puedes reclamar ante la Agencia
de Protección de Datos Personales.

#### 9. Seguridad

Aplicamos medidas técnicas y organizativas razonables para proteger tus datos contra
acceso no autorizado, pérdida o alteración.

#### 10. Cambios

Podemos actualizar esta política. Publicaremos la versión vigente en esta misma
dirección, indicando la fecha de la última actualización.

---

## Checklist antes de publicarla

- [ ] Completar todos los `[corchetes]`.
- [ ] Que un abogado la revise.
- [ ] Publicarla en una URL pública y estable (ej. `[sitio]/politica-privacidad`).
- [ ] Registrar esa URL en el aplicativo: **Administración → Inmobiliarias → Cumplimiento**.
- [ ] Que el plazo de retención del documento coincida con el configurado ahí.
- [ ] Enlazarla desde el sitio web y desde los formularios instantáneos de Meta.
