# SPEC 03 — Página «Acerca de» y envío de correo con Resend

> **Estado:** Implementado
> **Depende de:** SPEC 01, SPEC 02
> **Fecha:** 2026-09-22
> **Objetivo:** Portar `about.jsx` de `references/templates/home-about/` a la ruta `/acerca-de` y hacer que su formulario de contacto envíe un correo real a través de Resend desde un endpoint del servidor.

---

## Por qué existe este spec

SPEC 02 portó la landing y dejó «Acerca de» fuera a propósito: su formulario de contacto tiene decisiones propias —qué pasa con el envío, con los errores, con los bots— que no pertenecían a una página estática. También dejó fuera su enlace del Nav, porque añadirlo sin la ruta habría dejado un 404 alcanzable desde la barra.

Este spec cierra las dos cosas: la pantalla y el envío de verdad.

La diferencia de fondo con el prototipo es que allí el formulario **no envía nada**: `onSubmit` valida que los tres campos no estén vacíos y pinta la terminal VAULT-OS de éxito. Aquí esa terminal solo aparece cuando el correo ha salido (o cuando el servidor lo ha simulado explícitamente por falta de clave de API).

### Qué hay en la carpeta de referencia

| Archivo | Qué aporta a este spec |
| --- | --- |
| `about.jsx` (157 líneas) | La pantalla completa: `About` y `HighlightIcon`. Es la fuente de verdad visual y de copia. |
| `styles.css`, bloque ABOUT PAGE (líneas 1071–1150) | Los estilos de la pantalla. SPEC 02 los dejó sin copiar explícitamente. |
| `nav.jsx` (50 líneas) | El cuarto enlace, `Acerca de`, que SPEC 02 no añadió. |
| `home.jsx` | Ya portado en SPEC 02. No se toca. |
| `arcade-vault-standalone.html` | No se toca. |

### Qué del bloque ABOUT PAGE ya está en `app/globals.css`

| Regla del prototipo | Decisión |
| --- | --- |
| `.about-*`, `.highlight*`, `.div-*`, `.contact-*`, `.term-*`, `.terminal-success` | Se copian. |
| `@keyframes shake`, `@keyframes pxblink`, `.btn.press:active` | Se copian: no existen todavía. |
| `.divider` | **No se copia.** Ya está en `app/globals.css:1096`, idéntica. |
| `@keyframes blink` | **No se copia.** Ya está en `app/globals.css:1381`. |
| `.field`, `.field label`, `.field input`, `.btn.xl` | **No se copian.** Ya están (SPEC 01). Solo se añade `.contact-form textarea`, que no existía. |

Se añaden además dos reglas que **no** están en el prototipo, para el estado de error descrito abajo: `.terminal-success.error` y `.term-body .line.fail`.

---

## Alcance

**Dentro:**

- Nueva ruta `/acerca-de` con la pantalla completa: héroe «ACERCA DE ARCADE VAULT», las tres tarjetas de destacados con sus iconos pixel, el separador de píxeles y la sección de contacto (intro + formulario).
- Cuarto enlace **Acerca de** en el Nav (barra y panel móvil), con su estado activo.
- Formulario de contacto con tres campos (nombre, correo, mensaje) y su validación en cliente, incluido el `shake` del prototipo cuando falta algo.
- Endpoint `POST /api/contact` que valida en servidor y envía el correo con Resend.
- Correo al equipo en HTML con el lenguaje visual neon del proyecto, más su versión en texto plano, con `Reply-To` apuntando al correo del visitante.
- Autorespuesta de confirmación al visitante, enviada después del correo al equipo y **sin bloquear** el resultado.
- Modo simulación cuando `RESEND_API_KEY` no está configurada: el servidor registra el mensaje y responde éxito marcado como simulado.
- Terminal VAULT-OS en dos variantes: éxito (verde, la del prototipo) y error (magenta, con botón de reintento que conserva lo escrito).
- Protección anti-abuso: campo trampa, límite por IP en memoria y validación estricta de longitudes y formato en el servidor.
- Copia de los estilos del bloque ABOUT PAGE a `app/globals.css`, descontando lo que ya existe.
- Variables de entorno documentadas en `.env.example`, con `.env.local` fuera del control de versiones.
- Toda la copia en español.

**Fuera de alcance (para specs futuros):**

- Verificar un dominio propio en Resend. Este spec deja el remitente en una variable de entorno; el dominio es una tarea de infraestructura, no de código.
- Guardar los mensajes en base de datos o en cualquier almacén. El correo es el único destino.
- Webhooks de Resend, seguimiento de entregas, rebotes o bajas.
- Plantillas con `react-email`. El correo se compone con plantillas de cadena.
- Adjuntos en el formulario.
- CAPTCHA, Turnstile o reCAPTCHA. El campo trampa es toda la defensa automática de este spec.
- Límite por IP persistente (Redis, Upstash o similar). El de este spec vive en memoria del proceso.
- Envío sin JavaScript. El formulario se envía con `fetch`; ver la decisión correspondiente.
- Página de agradecimiento en ruta propia. El éxito se muestra en la misma pantalla.
- Runner de tests.

---

## Modelo de datos

**No hay persistencia.** Este spec no toca `localStorage`, ni `av_user`, ni `av_scores`, ni `lib/session.tsx`. Lo que introduce son el contrato del endpoint y tres constantes de presentación.

### Contrato de `POST /api/contact`

Petición, `Content-Type: application/json`:

```ts
// lib/contact.ts
export type ContactPayload = {
  name: string;   // 1–80 caracteres tras recortar espacios
  email: string;  // 1–254 caracteres, con formato de correo
  msg: string;    // 1–2000 caracteres tras recortar espacios
  website: string; // campo trampa: debe llegar vacío
};
```

Respuesta correcta, `200`:

```ts
export type ContactOk = {
  ok: true;
  /** true cuando no había RESEND_API_KEY y el envío solo se registró en el servidor. */
  simulated: boolean;
};
```

Respuesta con error:

```ts
export type ContactError = {
  ok: false;
  /** "validacion" → 400 · "limite" → 429 · "envio" → 502 · "metodo" → 415/405 */
  error: "validacion" | "limite" | "envio" | "metodo";
  /** Texto en español, listo para pintar en la terminal de error. */
  message: string;
  /** Solo en "validacion": qué campos fallaron. */
  fields?: Array<"name" | "email" | "msg">;
};
```

El campo trampa es la única excepción a la regla: si `website` llega con valor, el endpoint responde `200 { ok: true, simulated: true }` **sin enviar nada**. Un bot no debe poder distinguir el rechazo del éxito.

### Constantes de presentación

```ts
// app/acerca-de/page.tsx
type Highlight = { icon: HighlightIconKind; text: string; color: "cyan" | "magenta" | "green" };
// HighlightIconKind = "HEART" | "BROWSER" | "PLANT", exportado por components/about-icons.tsx
type Tip = { text: string; led: "green" | "yellow" | "magenta" };

const HIGHLIGHTS: Highlight[]; // 3 entradas, valores del prototipo sin cambios
const TIPS: Tip[];             // 3 entradas: RESPUESTA EN 24-48H · SUGERENCIAS BIENVENIDAS · SIN SPAM, JAMÁS
```

### Variables de entorno

| Variable | Obligatoria | Valor documentado en `.env.example` | Qué pasa si falta |
| --- | --- | --- | --- |
| `RESEND_API_KEY` | No (por ahora) | vacía | Modo simulación: se registra el mensaje en el servidor y se responde `simulated: true`. |
| `CONTACT_TO` | Sí | `tu-correo@ejemplo.com` | El endpoint responde `502` con `error: "envio"` y lo registra como error de configuración. |
| `RESEND_FROM` | No | `Arcade Vault <onboarding@resend.dev>` | Se usa ese mismo valor por defecto. |

Ninguna lleva prefijo `NEXT_PUBLIC_`: las tres se leen solo en el servidor, dentro del Route Handler. `.env.local` no se versiona; `.env.example` sí, con las claves vacías.

> **Nota sobre el remitente de pruebas:** `onboarding@resend.dev` solo puede entregar correo a la dirección de la cuenta de Resend. Con él, el correo al equipo llega (si `CONTACT_TO` es esa dirección) y la autorespuesta al visitante falla. Está previsto: ver el paso 7 y las decisiones.

---

## Plan de implementación

Cada paso deja el proyecto compilando y navegable.

1. **Dependencia y entorno.** `npm install resend`. Crear `.env.example` con las tres claves de la tabla y `.env.local` con `CONTACT_TO` ya puesto y `RESEND_API_KEY` vacía, a la espera de la clave real. Comprobar que `.env*.local` está ignorado en `.gitignore` (Next lo incluye por defecto; si no está, se añade). Prueba: `npm run dev` arranca igual que antes.

2. **CSS.** Copiar a `app/globals.css`, dentro de `@layer components` y al final del bloque portado, las líneas 1071–1150 de `references/templates/home-about/home-about/styles.css`, **descontando** `.divider` y `@keyframes blink` (ya presentes) y las reglas de `.field` / `.btn.xl` que SPEC 01 ya portó. Añadir `@keyframes shake` y `@keyframes pxblink` junto al resto de `@keyframes`, fuera del `@layer`. Añadir las dos reglas nuevas del estado de error:

   ```css
   .terminal-success.error { border-color: var(--magenta); box-shadow: 0 0 22px rgba(255,0,110,0.25); }
   .terminal-success.error .term-body .line { color: var(--magenta); }
   .term-body .line.fail { margin-top: 12px; color: var(--magenta); text-shadow: 0 0 6px rgba(255,0,110,0.45); font-weight: 700; }
   ```

   Prueba manual: las pantallas existentes se ven igual que antes.

3. **`lib/contact.ts`.** Tipos del contrato y una función de validación pura `validateContact(input: unknown): { ok: true; value: ContactPayload } | { ok: false; fields: Array<...> }`, usada por el cliente y por el servidor para no duplicar las reglas: campos obligatorios tras `trim()`, nombre ≤ 80, correo ≤ 254 con formato válido, mensaje ≤ 2000.

4. **`components/about-icons.tsx`.** Port de `HighlightIcon` con los tres SVG pixel (`HEART`, `BROWSER`, `PLANT`), tal cual, con `viewBox` y `strokeWidth` en camelCase. Server Component, sin `"use client"`. Se exporta también el tipo `HighlightIconKind`.

5. **`app/api/contact/route.ts`.** Route Handler con `export async function POST(request: Request)`:
   - Rechaza lo que no sea `application/json` con `415` y `error: "metodo"`.
   - Campo trampa: si `website` no está vacío, responde `200 { ok: true, simulated: true }` sin enviar.
   - Límite por IP: `Map<string, number[]>` en el módulo, máximo **3 envíos por IP cada 10 minutos**, con la IP leída de la cabecera `x-forwarded-for` (primer valor) y `"desconocida"` como respaldo. Al superarlo, `429` con `error: "limite"`.
   - Valida con `validateContact`; si falla, `400` con `error: "validacion"` y la lista de campos.
   - Si no hay `RESEND_API_KEY`: registra el mensaje con `console.info` y responde `200 { ok: true, simulated: true }`.
   - Si no hay `CONTACT_TO`: registra el error de configuración y responde `502` con `error: "envio"`.
   - Si hay clave: envía con Resend y responde `200 { ok: true, simulated: false }`. Si Resend devuelve error o lanza, se registra y se responde `502` con `error: "envio"`.

   Prueba: `curl -X POST localhost:3000/api/contact -H 'Content-Type: application/json' -d '{"name":"px_kai","email":"a@b.com","msg":"hola","website":""}'` devuelve `{"ok":true,"simulated":true}` y el mensaje aparece en la consola de `next dev`.

6. **`lib/contact-email.ts`.** Dos plantillas de cadena: `teamEmail(payload)` y `visitorEmail(payload)`, cada una con `subject`, `html` y `text`. El HTML del correo al equipo usa los colores neon del proyecto escritos como literales hexadecimales en estilos en línea (`#0a0a0f`, `#00f5ff`, `#ff006e`), porque en un correo no hay variables CSS ni hojas externas. El cuerpo del mensaje se escapa antes de interpolarlo en el HTML y los saltos de línea se convierten en `<br>`. Asunto del correo al equipo: `[Arcade Vault] Nuevo mensaje de {nombre}`.

7. **Envío en el endpoint.** Con la clave presente:
   - Correo al equipo: `from: RESEND_FROM`, `to: CONTACT_TO`, `replyTo: payload.email`. **Este es el que decide el resultado**: si falla, la respuesta es `502`.
   - Autorespuesta: `from: RESEND_FROM`, `to: payload.email`, enviada después. Su fallo se registra con `console.warn` y **no** cambia la respuesta, porque el mensaje al equipo ya llegó. Con el remitente de pruebas este fallo es lo esperado.

8. **`components/contact-form.tsx`.** Componente cliente (`"use client"`), el único de la pantalla. Estado: `form`, `status` (`"idle" | "sending" | "sent" | "error"`), `shake` y `errorMessage`.
   - `onSubmit` valida con `validateContact`; si falla, activa `shake` 400 ms y no envía, igual que el prototipo.
   - Si pasa, `status = "sending"`, el botón muestra `▶ ENVIANDO…` y queda deshabilitado, y se hace `fetch("/api/contact", { method: "POST" })`.
   - Éxito: `status = "sent"` y terminal verde con el nombre en mayúsculas, como el prototipo. Si la respuesta trae `simulated: true`, se añade una línea más: `[DEV] RESEND_API_KEY no configurada · mensaje registrado en el servidor`. `ENVIAR OTRO MENSAJE` limpia el formulario.
   - Error (incluido el fallo de red): `status = "error"` y terminal magenta con `[ERROR] TRANSMISIÓN FALLIDA` y el mensaje del servidor. `REINTENTAR` vuelve al formulario **con lo escrito intacto**.
   - Campo trampa: `<input name="website" tabIndex={-1} autoComplete="off" aria-hidden="true" />` dentro de un contenedor con `position:absolute; left:-9999px`, nunca con `display:none`.
   - `<noscript>` dentro del formulario avisando de que el envío necesita JavaScript.

9. **`app/acerca-de/page.tsx`.** Server Component que monta la pantalla en el orden del prototipo: `about-hero` (kicker `▸ ACERCA DE`, título, misión, `highlight-row` con `HIGHLIGHTS` y su `transitionDelay` escalonado de 80 ms), `about-divider` con los 24 píxeles, y `about-contact` con la columna de intro (kicker `▸ CONTACTO`, título, subtítulo, `TIPS`) y `<ContactForm />`. Exporta `metadata` con título «Acerca de · Arcade Vault». El `IntersectionObserver` del prototipo **no se porta**: las secciones llevan la clase `reveal` que SPEC 02 ya definió en CSS puro.

10. **Nav.** Añadir `Acerca de` después de `Salón de la Fama`, en la barra y en el panel móvil, con `aboutActive = pathname === "/acerca-de"` y su `aria-current`. Es el único cambio en `components/nav.tsx`.

11. **Verificación final.** `npx next typegen`, `npm run lint`, `npx tsc --noEmit` y `npm run build`. Recorrer el checklist de abajo en el navegador.

### Archivos que aparecen o cambian

| Archivo | Qué |
| --- | --- |
| `app/acerca-de/page.tsx` | Nuevo. Pantalla, Server Component. |
| `components/contact-form.tsx` | Nuevo. Formulario, componente cliente. |
| `components/about-icons.tsx` | Nuevo. Los tres SVG de destacados. |
| `app/api/contact/route.ts` | Nuevo. Endpoint de envío. |
| `lib/contact.ts` | Nuevo. Tipos del contrato y validación compartida. |
| `lib/contact-email.ts` | Nuevo. Plantillas HTML y texto de los dos correos. |
| `app/globals.css` | Se le añade el bloque ABOUT PAGE, descontando lo ya presente, más las reglas del estado de error. |
| `components/nav.tsx` | Cuarto enlace y su estado activo. |
| `.env.example` | Nuevo. Las tres claves, vacías o con el valor por defecto. |
| `.env.local` | Nuevo, sin versionar. |
| `package.json` / `package-lock.json` | Dependencia `resend`. |

---

## Criterios de aceptación

**Compilación y tipos**

- [ ] `npm run build` termina sin errores.
- [ ] `npm run lint` termina sin errores.
- [ ] `npx tsc --noEmit` termina sin errores.
- [ ] La consola del navegador no muestra errores ni avisos de hidratación en `/acerca-de`.

**Ruta y Nav**

- [ ] `/acerca-de` responde 200 y muestra la pantalla completa.
- [ ] El Nav muestra cuatro enlaces: Inicio, Biblioteca, Salón de la Fama y Acerca de, en ese orden.
- [ ] En `/acerca-de` está activo «Acerca de» y ningún otro.
- [ ] El panel móvil (por debajo de 860 px) incluye también «Acerca de».
- [ ] Las rutas `/inicio`, `/juegos`, `/juego/[id]`, `/jugar/[id]`, `/acceso` y `/salon` siguen funcionando sin cambios visuales.

**Pantalla**

- [ ] El título «ACERCA DE ARCADE VAULT» se ve con el degradado blanco → cian del prototipo.
- [ ] Se muestran 3 tarjetas de destacados, con sus iconos pixel y sus colores: magenta, cian y verde.
- [ ] El separador muestra 24 píxeles parpadeando con retardo escalonado.
- [ ] La columna de contacto muestra los tres avisos con sus LED verde, amarillo y magenta.
- [ ] Toda la copia visible está en español, con acentos correctos.
- [ ] **Con JavaScript desactivado, `/acerca-de` muestra la pantalla entera**, incluidos los campos del formulario, y el `<noscript>` avisa de que el envío no funcionará.

**Validación en cliente**

- [ ] Enviar con cualquiera de los tres campos vacío agita el formulario y no hace ninguna petición de red.
- [ ] Mientras se envía, el botón muestra `▶ ENVIANDO…` y no se puede pulsar dos veces.

**Endpoint**

- [ ] Un `POST` válido sin `RESEND_API_KEY` devuelve `200 {"ok":true,"simulated":true}` y el mensaje aparece en la consola del servidor.
- [ ] Un `POST` con `msg` vacío devuelve `400` con `error: "validacion"` y `fields` incluyendo `"msg"`.
- [ ] Un `POST` con `msg` de 2001 caracteres devuelve `400`.
- [ ] Un `POST` con `website` relleno devuelve `200 {"ok":true,"simulated":true}` y **no** registra ni envía ningún mensaje.
- [ ] El cuarto `POST` válido desde la misma IP dentro de 10 minutos devuelve `429` con `error: "limite"`.
- [ ] `GET /api/contact` no devuelve `200`.
- [ ] `grep -rn "RESEND_API_KEY\|CONTACT_TO\|RESEND_FROM" app components lib` solo devuelve coincidencias dentro de `app/api/contact/route.ts`.
- [ ] `grep -rn "NEXT_PUBLIC_" .env.example` no devuelve nada.

**Envío real (se verifica una vez puesta la clave de API)**

- [ ] Con `RESEND_API_KEY` y `CONTACT_TO` configuradas, un envío desde el formulario hace llegar el correo a `CONTACT_TO`.
- [ ] Ese correo lleva `Reply-To` con el correo escrito en el formulario, y responderlo va al visitante.
- [ ] El asunto es `[Arcade Vault] Nuevo mensaje de {nombre}` y el cuerpo contiene el nombre, el correo y el mensaje completo.
- [ ] El correo se ve correctamente en un cliente que bloquea imágenes y hojas de estilo externas.
- [ ] Un mensaje con `<script>` en el cuerpo llega escapado como texto, no interpretado.
- [ ] Con el remitente de pruebas, el fallo de la autorespuesta se registra en el servidor y **el visitante sigue viendo la terminal de éxito**.

**Estados de la terminal**

- [ ] Tras un envío correcto aparece la terminal verde con `MENSAJE RECIBIDO` y el nombre en mayúsculas.
- [ ] En modo simulación, esa terminal incluye además la línea `[DEV] RESEND_API_KEY no configurada`.
- [ ] `ENVIAR OTRO MENSAJE` devuelve el formulario vacío.
- [ ] Si el endpoint devuelve `502`, aparece la terminal magenta con `[ERROR] TRANSMISIÓN FALLIDA`.
- [ ] Si el servidor está caído (fallo de red), aparece también la terminal de error, no una pantalla en blanco ni un error en consola sin tratar.
- [ ] `REINTENTAR` devuelve el formulario **con el nombre, el correo y el mensaje que se habían escrito**.

**Componentes cliente**

- [ ] `grep -rn "use client" app/acerca-de/page.tsx components/about-icons.tsx` no devuelve nada.
- [ ] `components/contact-form.tsx` es el único archivo nuevo con `"use client"`.

---

## Decisiones

- **Sí:** ruta `/acerca-de`. Mantiene la convención de rutas en español del proyecto (`/inicio`, `/juegos`, `/salon`, `/acceso`) y coincide con la etiqueta del enlace.
- **Sí:** Route Handler `POST /api/contact` llamado con `fetch`, decisión del usuario. La clave de Resend se queda en el servidor y el endpoint queda reutilizable desde cualquier otro sitio.
- **No:** Server Action con `useActionState`. Era la alternativa que habría funcionado sin JavaScript, pero el usuario eligió el endpoint explícito. Se asume el coste y se documenta en riesgos.
- **Sí:** un `<noscript>` dentro del formulario. Ningún **contenido** depende de JavaScript —la pantalla entera se ve sin él—, pero el **envío** sí, y callarlo dejaría un formulario que no responde al pulsar el botón.
- **Sí:** validación duplicada, en cliente y en servidor, con la misma función de `lib/contact.ts`. La del cliente da el `shake` inmediato del prototipo; la del servidor es la que manda, porque el endpoint es público.
- **Sí:** modo simulación cuando falta `RESEND_API_KEY`. El usuario pondrá la clave más adelante y la pantalla debe poder terminarse y verificarse hoy. Se marca con `simulated: true` y una línea visible en la terminal para que nadie confunda una simulación con un envío.
- **No:** responder `503` sin clave. Habría obligado a mirar la pantalla rota hasta tener la clave.
- **Sí:** terminal de error en magenta reutilizando `terminal-success`. El prototipo no tenía estado de error; en vez de inventar un lenguaje visual nuevo, se reusa el que ya existe cambiando el color.
- **Sí:** `REINTENTAR` conserva lo escrito. Perder un mensaje largo por un fallo del servidor es la peor forma de terminar el formulario.
- **Sí:** las tres protecciones anti-abuso (campo trampa, límite por IP, validación estricta). El endpoint es público y no cuesta nada dejarlo cerrado desde el principio.
- **Sí:** el campo trampa responde éxito en vez de error. Un bot que recibe un `400` aprende a evitar el campo; uno que recibe `200` no aprende nada.
- **No:** CAPTCHA. Añade un servicio externo y un script de terceros para un formulario que todavía no recibe tráfico.
- **Sí:** límite por IP en un `Map` en memoria, aun sabiendo que se pierde al reiniciar y que no vale con varias instancias. Frena el abuso evidente sin añadir infraestructura; cuando haga falta algo serio, será su propio spec.
- **Sí:** autorespuesta al visitante, pero sin poder tumbar el resultado. El objetivo del formulario es que el mensaje llegue al equipo; si eso ocurre, el envío fue un éxito aunque la cortesía falle.
- **Sí:** remitente y destinatario en variables de entorno, sin ninguna dirección escrita en el código. Cambiar de dominio no debe ser un cambio de código.
- **No:** `react-email`. Dos correos no justifican una dependencia más y un paso de compilación de plantillas.
- **Sí:** escapar el mensaje antes de meterlo en el HTML del correo. El cuerpo lo escribe un desconocido.
- **No:** guardar los mensajes en ninguna parte. El proyecto no tiene capa de datos y añadirla por un formulario sería empezar la casa por el tejado.
- **No:** portar el `IntersectionObserver` de `about.jsx`. SPEC 02 ya resolvió la animación de entrada en CSS puro por la misma razón que allí: nada visible debe depender de que se ejecute JavaScript.
- **Sí:** un único componente cliente, el formulario. El resto de la pantalla es contenido estático.

---

## Riesgos

| Riesgo | Mitigación |
| --- | --- |
| Sin JavaScript el formulario no envía nada, y el visitante puede no darse cuenta | El `<noscript>` del paso 8 lo dice explícitamente, y hay un criterio de aceptación que lo verifica. La pantalla completa sigue siendo visible sin JS. |
| Con `onboarding@resend.dev` la autorespuesta al visitante falla siempre | Está previsto en el diseño: su fallo se registra y no cambia la respuesta. Desaparece solo al configurar un dominio verificado en `RESEND_FROM`. |
| Con `onboarding@resend.dev`, `CONTACT_TO` debe ser exactamente la dirección de la cuenta de Resend o tampoco llega el correo al equipo | `.env.local` ya se entrega con `CONTACT_TO` (la dirección de la cuenta de Resend), y el criterio de envío real se verifica en cuanto se ponga la clave. |
| La clave de API se filtra al cliente | Se lee solo dentro de `app/api/contact/route.ts`, sin prefijo `NEXT_PUBLIC_`, y hay un criterio con `grep` que lo comprueba. |
| El límite por IP se evade detrás de un proxy que no manda `x-forwarded-for`, o se aplica de más si varios usuarios comparten IP | Asumido: es la mitigación barata. El respaldo `"desconocida"` agrupa a todos los que no traen cabecera, lo que es conservador. |
| El `Map` del límite crece sin fin en un proceso de larga vida | Al comprobar cada IP se descartan sus marcas de tiempo caducadas, y la entrada se elimina cuando se queda vacía. |
| Colisión de nombres de `@keyframes` (`shake`, `pxblink`) con los ya portados | Se comprueba en el paso 2 antes de copiar; `blink` ya existe y por eso no se copia. |
| El correo en HTML se ve roto en algún cliente | Estilos en línea, sin hojas externas ni variables CSS, y versión `text` siempre presente. Hay un criterio que lo verifica con imágenes bloqueadas. |
| Un mensaje de 2000 caracteres con HTML dentro llega interpretado | El cuerpo se escapa en el paso 6, con criterio de aceptación propio. |
| `.env.local` acaba versionado | El paso 1 incluye comprobar `.gitignore` antes de crear el archivo. |
