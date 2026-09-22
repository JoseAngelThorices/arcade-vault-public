// Endpoint del formulario de contacto.
//
// Es el unico sitio del proyecto que lee RESEND_API_KEY, CONTACT_TO y
// RESEND_FROM: ninguna lleva prefijo NEXT_PUBLIC_ y ninguna sale de este modulo.
//
// Orden de las comprobaciones, y por que:
//   1. Content-Type   descarta lo que ni siquiera dice ser JSON.
//   2. Campo trampa   antes del limite por IP, para que un bot no gaste cuota
//                     ajena ni reciba una respuesta distinta de la de un humano.
//   3. Limite por IP   antes de validar, porque validar ya es trabajo.
//   4. Validacion     la que manda: el endpoint es publico.

import { Resend } from "resend";

import { teamEmail, visitorEmail } from "@/lib/contact-email";
import {
  validateContact,
  type ContactError,
  type ContactField,
  type ContactOk,
  type ContactPayload,
} from "@/lib/contact";

/** Remitente por defecto: el de pruebas de Resend, que no necesita dominio propio. */
const DEFAULT_FROM = "Arcade Vault <onboarding@resend.dev>";

/** Mismo texto para todos los fallos de envio: al visitante no le sirve el detalle. */
const ENVIO_FALLIDO = "No hemos podido enviar el mensaje. Escríbenos directamente si urge.";

/** Envios permitidos por IP dentro de la ventana. */
const RATE_LIMIT = 3;
/** Ventana del limite, en milisegundos. */
const RATE_WINDOW_MS = 10 * 60 * 1000;

/**
 * Marcas de tiempo de los envios aceptados, por IP.
 *
 * Vive en memoria del proceso: se pierde al reiniciar y no se comparte entre
 * instancias. Es deliberado (ver decisiones del SPEC 03): frena el abuso obvio
 * sin anadir infraestructura. Cuando haga falta algo serio, sera su propio spec.
 */
const hits = new Map<string, number[]>();

function ok(simulated: boolean): Response {
  return Response.json({ ok: true, simulated } satisfies ContactOk);
}

function fail(status: number, error: ContactError["error"], message: string, fields?: ContactField[]): Response {
  return Response.json({ ok: false, error, message, ...(fields ? { fields } : {}) } satisfies ContactError, {
    status,
  });
}

/** Primer valor de x-forwarded-for, o "desconocida" si no viene la cabecera. */
function clientIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  const first = forwarded?.split(",")[0]?.trim();
  return first && first.length > 0 ? first : "desconocida";
}

/**
 * Registra un envio y dice si la IP se ha pasado del limite.
 *
 * Aprovecha la consulta para descartar las marcas caducadas y borrar la entrada
 * cuando se queda vacia, que es lo que evita que el Map crezca sin fin. Un envio
 * rechazado no deja marca: si la dejara, la ventana no drenaria nunca.
 */
function rateLimited(ip: string): boolean {
  const now = Date.now();
  const recent = (hits.get(ip) ?? []).filter((t) => now - t < RATE_WINDOW_MS);

  if (recent.length >= RATE_LIMIT) {
    hits.set(ip, recent);
    return true;
  }

  recent.push(now);
  hits.set(ip, recent);
  return false;
}

/** Purga las IP sin marcas vivas. Se llama en cada peticion: el Map es pequeno. */
function sweep(): void {
  const now = Date.now();
  for (const [ip, times] of hits) {
    const recent = times.filter((t) => now - t < RATE_WINDOW_MS);
    if (recent.length === 0) hits.delete(ip);
    else hits.set(ip, recent);
  }
}

export async function POST(request: Request): Promise<Response> {
  const contentType = request.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) {
    return fail(415, "metodo", "El cuerpo de la petición debe ser JSON.");
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return fail(400, "validacion", "No hemos podido leer el formulario. Vuelve a intentarlo.", [
      "name",
      "email",
      "msg",
    ]);
  }

  // Campo trampa. Responde exito sin enviar nada: un bot que recibe un 400
  // aprende a evitar el campo, uno que recibe 200 no aprende nada.
  const website = (body as { website?: unknown } | null)?.website;
  if (typeof website === "string" && website.trim().length > 0) {
    // Al bot se le responde exito, pero aqui queda anotado. Un navegador que
    // autorellena el campo entra por aqui sin que el visitante se entere, y sin
    // esta linea el mensaje se perderia sin dejar ni rastro.
    console.warn(`[contacto] Campo trampa relleno, no se envia nada. Valor recibido: ${JSON.stringify(website)}`);
    return ok(true);
  }

  sweep();
  const ip = clientIp(request);
  if (rateLimited(ip)) {
    console.warn(`[contacto] Limite por IP alcanzado (${ip}): ${RATE_LIMIT} envios en ${RATE_WINDOW_MS / 60000} min.`);
    return fail(429, "limite", "Has enviado demasiados mensajes seguidos. Prueba dentro de un rato.");
  }

  const validation = validateContact(body);
  if (!validation.ok) {
    console.warn(`[contacto] Validacion fallida en el servidor: ${validation.fields.join(", ")}`);
    return fail(400, "validacion", "Revisa los campos marcados.", validation.fields);
  }

  const payload = validation.value;

  // Sin clave de API no se envia nada: se registra y se responde exito marcado
  // como simulado, para que la pantalla pueda terminarse y verificarse hoy.
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    logSimulated(payload);
    return ok(true);
  }

  const to = process.env.CONTACT_TO;
  if (!to) {
    console.error("[contacto] CONTACT_TO no esta configurada: no hay a quien enviar el mensaje.");
    return fail(502, "envio", ENVIO_FALLIDO);
  }

  const from = process.env.RESEND_FROM || DEFAULT_FROM;
  const resend = new Resend(apiKey);

  // El correo al equipo es el que decide el resultado: si no sale, el envio ha
  // fallado, y da igual lo bien que fuera todo lo demas.
  const team = teamEmail(payload);
  try {
    const { error } = await resend.emails.send({
      from,
      to,
      replyTo: payload.email,
      subject: team.subject,
      html: team.html,
      text: team.text,
    });

    if (error) {
      console.error(`[contacto] Resend rechazo el mensaje al equipo: ${describe(error)}`);
      return fail(502, "envio", ENVIO_FALLIDO);
    }
  } catch (cause) {
    console.error(`[contacto] No se ha podido contactar con Resend: ${describe(cause)}`);
    return fail(502, "envio", ENVIO_FALLIDO);
  }

  // Autorespuesta al visitante. Va despues y no puede tumbar el resultado: el
  // objetivo del formulario es que el mensaje llegue al equipo, y ya ha llegado.
  // Con el remitente de pruebas de Resend este fallo es lo esperado, porque solo
  // entrega correo a la direccion de la cuenta.
  const visitor = visitorEmail(payload);
  try {
    const { error } = await resend.emails.send({
      from,
      to: payload.email,
      subject: visitor.subject,
      html: visitor.html,
      text: visitor.text,
    });

    if (error) {
      console.warn(`[contacto] La autorespuesta al visitante no ha salido: ${describe(error)}`);
    }
  } catch (cause) {
    console.warn(`[contacto] La autorespuesta al visitante ha lanzado: ${describe(cause)}`);
  }

  console.info(`[contacto] Mensaje de ${payload.email} entregado a ${to}.`);
  return ok(false);
}

/** El endpoint solo acepta POST. Devuelve la misma forma de error que el resto. */
export async function GET(): Promise<Response> {
  return fail(405, "metodo", "Este endpoint solo acepta POST.");
}

/** Aplana un error de Resend a una linea legible en el log del servidor. */
function describe(cause: unknown): string {
  if (cause instanceof Error) return `${cause.name}: ${cause.message}`;
  if (typeof cause === "object" && cause !== null) {
    const { name, message, statusCode } = cause as Record<string, unknown>;
    if (message) return [statusCode, name, message].filter(Boolean).join(" ");
    return JSON.stringify(cause);
  }
  return String(cause);
}

function logSimulated(payload: ContactPayload): void {
  console.info(
    [
      "[contacto] RESEND_API_KEY no configurada: mensaje registrado, no enviado.",
      `  nombre: ${payload.name}`,
      `  correo: ${payload.email}`,
      `  mensaje: ${payload.msg}`,
    ].join("\n"),
  );
}
