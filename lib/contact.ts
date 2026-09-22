// Contrato de POST /api/contact y validación compartida.
//
// La misma función corre en los dos lados: en el cliente da el `shake` inmediato
// del prototipo y en el servidor es la que manda, porque el endpoint es público.
// Por eso este módulo no importa nada de React ni de Node: es lógica pura.

/** Cuerpo de la petición. Los tres campos visibles, más el campo trampa. */
export type ContactPayload = {
  /** 1–80 caracteres tras recortar espacios. */
  name: string;
  /** 1–254 caracteres, con formato de correo. */
  email: string;
  /** 1–2000 caracteres tras recortar espacios. */
  msg: string;
  /** Campo trampa: debe llegar vacío. Lo comprueba el endpoint, no `validateContact`. */
  website: string;
};

/** Campos que el visitante rellena y que, por tanto, pueden fallar la validación. */
export type ContactField = "name" | "email" | "msg";

/** Respuesta correcta del endpoint (200). */
export type ContactOk = {
  ok: true;
  /** true cuando no había clave de API y el envío solo se registró en el servidor. */
  simulated: boolean;
};

/** Respuesta con error del endpoint. */
export type ContactError = {
  ok: false;
  /** "validacion" → 400 · "limite" → 429 · "envio" → 502 · "metodo" → 415/405 */
  error: "validacion" | "limite" | "envio" | "metodo";
  /** Texto en español, listo para pintar en la terminal de error. */
  message: string;
  /** Solo en "validacion": qué campos fallaron. */
  fields?: ContactField[];
};

export type ContactResponse = ContactOk | ContactError;

export const MAX_NAME = 80;
export const MAX_EMAIL = 254;
export const MAX_MSG = 2000;

/**
 * Formato de correo. No pretende cumplir el RFC 5322 —ningún regex razonable lo
 * hace—, solo descartar lo que es obviamente inválido: exige algo, una arroba,
 * algo, un punto y algo, sin espacios. La comprobación de verdad es que el
 * correo llegue, y de eso ya se encarga Resend.
 */
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export type ValidationResult =
  | { ok: true; value: ContactPayload }
  | { ok: false; fields: ContactField[] };

/** Devuelve el texto recortado, o "" si no era una cadena. */
function asTrimmed(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

/**
 * Valida un cuerpo de origen desconocido y devuelve los valores ya recortados.
 *
 * Acumula todos los campos que fallan en vez de parar en el primero, para que la
 * respuesta pueda señalarlos a la vez. El campo trampa se deja pasar tal cual:
 * quien decide qué hacer con él es el endpoint, y en silencio.
 */
export function validateContact(input: unknown): ValidationResult {
  const source = (typeof input === "object" && input !== null ? input : {}) as Record<string, unknown>;

  const name = asTrimmed(source.name);
  const email = asTrimmed(source.email);
  const msg = asTrimmed(source.msg);
  const website = asTrimmed(source.website);

  const fields: ContactField[] = [];

  if (name.length === 0 || name.length > MAX_NAME) fields.push("name");
  if (email.length === 0 || email.length > MAX_EMAIL || !EMAIL_RE.test(email)) fields.push("email");
  if (msg.length === 0 || msg.length > MAX_MSG) fields.push("msg");

  if (fields.length > 0) return { ok: false, fields };

  return { ok: true, value: { name, email, msg, website } };
}
