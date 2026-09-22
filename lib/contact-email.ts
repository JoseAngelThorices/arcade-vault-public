// Plantillas de los dos correos del formulario de contacto.
//
// Son cadenas, no componentes: un correo no tiene variables CSS, ni hojas
// externas, ni clases. Todo va en estilos en linea y con los colores del tema
// escritos como literales hexadecimales, porque var(--cyan) no existe aqui.
//
// El formato es la transcripcion de la terminal VAULT-OS, el mismo dispositivo
// que el visitante acaba de ver en pantalla. La tipografia pixel no sobrevive al
// correo (ningun cliente carga webfonts de forma fiable), asi que ese papel lo
// hace el monoespaciado con tracking. El cuerpo del mensaje, en cambio, va en
// caja legible y sin resplandor: su trabajo es que se lea y se conteste.
//
// Cada plantilla trae siempre `text` ademas de `html`, para el cliente que no
// pinta HTML o que bloquea todo lo que no sea texto.

import type { ContactPayload } from "@/lib/contact";

export type ContactEmail = {
  subject: string;
  html: string;
  text: string;
};

// Tokens del tema, resueltos a hexadecimal solido.
const BG = "#0a0a0f";
const PANEL = "#0f0f18";
/** rgba(0,245,255,0.18) de --line, ya fundido sobre el fondo. */
const LINE = "#08343a";
const CYAN = "#00f5ff";
const MAGENTA = "#ff006e";
const GREEN = "#00ff88";
const INK = "#e6e9ff";
const INK_DIM = "#8a8fb5";
const INK_FAINT = "#4a4f70";

const MONO = "'JetBrains Mono', 'Courier New', Courier, monospace";

/** Escapa el texto que escribe un desconocido antes de meterlo en el HTML. */
function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** Escapa y convierte los saltos de linea en <br>. */
function escapeLines(value: string): string {
  return escapeHtml(value).replace(/\r?\n/g, "<br />");
}

/**
 * Deja un valor apto para una cabecera: sin saltos de linea ni caracteres de
 * control. El asunto lleva un nombre que escribe un desconocido.
 */
function headerSafe(value: string): string {
  return value.replace(/[\r\n\u0000-\u001f\u007f]+/g, " ").trim();
}

/** Texto de vista previa del buzon. Se pinta oculto, antes del cuerpo. */
function preheader(value: string): string {
  const text = escapeHtml(value.replace(/\s+/g, " ").trim().slice(0, 140));
  return `<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;font-size:1px;line-height:1px">${text}</div>`;
}

/** Fila de campo: etiqueta pequena a la izquierda, valor a la derecha. */
function fieldRow(label: string, valueHtml: string): string {
  return `<tr>
              <td style="padding:0 0 14px;font-family:${MONO};font-size:10px;letter-spacing:0.16em;text-transform:uppercase;color:${MAGENTA};white-space:nowrap;vertical-align:top;width:92px">${escapeHtml(label)}</td>
              <td style="padding:0 0 14px;font-family:${MONO};font-size:14px;color:${INK};word-break:break-word">${valueHtml}</td>
            </tr>`;
}

/**
 * Marco comun de los dos correos: fondo, barra de terminal con sus tres puntos
 * y pie. Toda la maquetacion va en tablas, que es lo unico que entienden por
 * igual todos los clientes de correo.
 */
function shell(options: {
  accent: string;
  preview: string;
  termTitle: string;
  heading: string;
  body: string;
  footer: string;
}): string {
  const { accent, preview, termTitle, heading, body, footer } = options;

  return `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<meta name="color-scheme" content="dark" />
<title>${escapeHtml(termTitle)}</title>
</head>
<body style="margin:0;padding:0;background:${BG};color:${INK}">
${preheader(preview)}
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${BG}" style="background:${BG};margin:0;padding:0">
  <tr>
    <td align="center" style="padding:28px 12px">

      <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:600px;background:${PANEL};border:1px solid ${LINE}">

        <tr>
          <td style="padding:14px 18px;background:${BG};border-bottom:1px solid ${LINE}">
            <table role="presentation" cellpadding="0" cellspacing="0" border="0">
              <tr>
                <td width="12" style="width:12px"><div style="width:9px;height:9px;background:#ff5f56;border-radius:9px;font-size:0;line-height:0">&nbsp;</div></td>
                <td width="12" style="width:12px"><div style="width:9px;height:9px;background:#ffbd2e;border-radius:9px;font-size:0;line-height:0">&nbsp;</div></td>
                <td width="20" style="width:20px"><div style="width:9px;height:9px;background:#27c93f;border-radius:9px;font-size:0;line-height:0">&nbsp;</div></td>
                <td style="font-family:${MONO};font-size:10px;letter-spacing:0.16em;color:${INK_FAINT}">${escapeHtml(termTitle)}</td>
              </tr>
            </table>
          </td>
        </tr>

        <tr>
          <td style="padding:30px 32px 8px">
            <div style="font-family:${MONO};font-size:13px;color:${CYAN};letter-spacing:0.02em;padding-bottom:18px">vault@arcade:~$</div>
            <div style="font-family:${MONO};font-size:19px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;color:${accent};line-height:1.4">${escapeHtml(heading)}</div>
          </td>
        </tr>

        <tr>
          <td style="padding:24px 32px 30px">${body}</td>
        </tr>

        <tr>
          <td style="padding:16px 32px 22px;border-top:1px solid ${LINE}">
            <div style="font-family:${MONO};font-size:11px;line-height:1.7;color:${INK_FAINT}">${footer}</div>
          </td>
        </tr>

      </table>

      <div style="font-family:${MONO};font-size:10px;letter-spacing:0.18em;text-transform:uppercase;color:${INK_FAINT};padding-top:18px">Arcade Vault</div>

    </td>
  </tr>
</table>
</body>
</html>`;
}

/** El mensaje que llega al equipo. Su Reply-To apunta al visitante. */
export function teamEmail(payload: ContactPayload): ContactEmail {
  const { name, email, msg } = payload;

  const body = `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
            ${fieldRow("De", escapeHtml(name))}
            ${fieldRow("Correo", `<a href="mailto:${escapeHtml(email)}" style="color:${CYAN};text-decoration:none">${escapeHtml(email)}</a>`)}
          </table>

          <div style="border-left:2px solid ${CYAN};background:${BG};padding:18px 20px;margin-top:8px">
            <div style="font-family:${MONO};font-size:15px;line-height:1.8;color:${INK};word-break:break-word">${escapeLines(msg)}</div>
          </div>`;

  const footer = `Responde a este correo y tu respuesta le llega directamente a ${escapeHtml(name)}.`;

  const text = [
    "VAULT-OS // MENSAJE ENTRANTE",
    "",
    `De: ${name}`,
    `Correo: ${email}`,
    "",
    "Mensaje:",
    msg,
    "",
    "--",
    `Responde a este correo y tu respuesta le llega directamente a ${name}.`,
  ].join("\n");

  return {
    subject: headerSafe(`[Arcade Vault] Nuevo mensaje de ${name}`),
    html: shell({
      accent: CYAN,
      preview: msg,
      termTitle: "VAULT-OS // MENSAJE ENTRANTE",
      heading: `Nuevo mensaje de ${name}`,
      body,
      footer,
    }),
    text,
  };
}

/** La confirmacion que recibe el visitante, con copia de lo que escribio. */
export function visitorEmail(payload: ContactPayload): ContactEmail {
  const { name, msg } = payload;

  const body = `<div style="font-family:${MONO};font-size:15px;line-height:1.8;color:${INK_DIM};padding-bottom:22px">
            Gracias por escribirnos, ${escapeHtml(name)}. Tu mensaje ya está en la bandeja del equipo y te respondemos en 24-48 horas.
          </div>

          <div style="font-family:${MONO};font-size:10px;letter-spacing:0.16em;text-transform:uppercase;color:${MAGENTA};padding-bottom:10px">Esto fue lo que nos contaste</div>
          <div style="border-left:2px solid ${GREEN};background:${BG};padding:18px 20px">
            <div style="font-family:${MONO};font-size:14px;line-height:1.8;color:${INK};word-break:break-word">${escapeLines(msg)}</div>
          </div>`;

  const footer = "Recibes este correo porque alguien escribió desde el formulario de Arcade Vault. Si no fuiste tú, ignóralo: no te hemos apuntado a nada.";

  const text = [
    "VAULT-OS // MENSAJE RECIBIDO",
    "",
    `Gracias por escribirnos, ${name}. Tu mensaje ya está en la bandeja del equipo y te respondemos en 24-48 horas.`,
    "",
    "Esto fue lo que nos contaste:",
    msg,
    "",
    "--",
    footer,
  ].join("\n");

  return {
    subject: headerSafe("Hemos recibido tu mensaje en Arcade Vault"),
    html: shell({
      accent: GREEN,
      preview: "Tu mensaje ya esta en la bandeja del equipo. Te respondemos en 24-48 horas.",
      termTitle: "VAULT-OS // MENSAJE RECIBIDO",
      heading: "Mensaje recibido",
      body,
      footer,
    }),
    text,
  };
}
