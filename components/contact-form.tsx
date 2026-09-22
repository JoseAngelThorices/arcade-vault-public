"use client";

// Formulario de contacto (references/templates/home-about/home-about/about.jsx).
//
// Es el unico componente cliente de /acerca-de: el resto de la pantalla es
// contenido estatico y se renderiza en el servidor.
//
// La diferencia de fondo con el prototipo es que alli onSubmit no enviaba nada,
// solo pintaba la terminal de exito. Aqui la terminal verde aparece cuando el
// correo ha salido de verdad, o cuando el servidor ha dicho explicitamente que
// lo ha simulado por falta de clave de API.

import { useEffect, useRef, useState } from "react";

import {
  MAX_EMAIL,
  MAX_MSG,
  MAX_NAME,
  validateContact,
  type ContactField,
  type ContactResponse,
} from "@/lib/contact";

type Status = "idle" | "sending" | "sent" | "error";

const VACIO = { name: "", email: "", msg: "" };

export default function ContactForm() {
  const [form, setForm] = useState(VACIO);
  const [status, setStatus] = useState<Status>("idle");
  const [shake, setShake] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [simulated, setSimulated] = useState(false);
  const [invalid, setInvalid] = useState<ContactField[]>([]);

  // El campo trampa no es estado de React: se lee del DOM al enviar, para que
  // rellenarlo sea indistinguible de no tocarlo.
  const website = useRef<HTMLInputElement>(null);
  const shakeTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => () => clearTimeout(shakeTimer.current), []);

  const set = (field: keyof typeof VACIO) => (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setForm((current) => ({ ...current, [field]: event.target.value }));
  };

  const onSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (status === "sending") return;

    const payload = { ...form, website: website.current?.value ?? "" };
    const check = validateContact(payload);

    // Misma sacudida que el prototipo, y ni una peticion de red.
    if (!check.ok) {
      setInvalid(check.fields);
      setShake(true);
      clearTimeout(shakeTimer.current);
      shakeTimer.current = setTimeout(() => setShake(false), 400);
      return;
    }

    setInvalid([]);
    setStatus("sending");

    try {
      const response = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data: ContactResponse = await response.json();

      if (data.ok) {
        setSimulated(data.simulated);
        setStatus("sent");
        return;
      }

      setErrorMessage(data.message);
      setStatus("error");
    } catch {
      // El servidor caido o sin red entra por aqui. Tambien merece terminal, no
      // una pantalla muda ni un error suelto en la consola.
      setErrorMessage("No hemos podido conectar con el servidor. Comprueba tu conexion e intentalo otra vez.");
      setStatus("error");
    }
  };

  const otroMensaje = () => {
    setForm(VACIO);
    setSimulated(false);
    setStatus("idle");
  };

  // Reintentar conserva lo escrito: perder un mensaje largo por un fallo del
  // servidor es la peor forma de terminar el formulario.
  const reintentar = () => {
    setErrorMessage("");
    setStatus("idle");
  };

  const enviando = status === "sending";
  const fallo = (field: ContactField) => (invalid.includes(field) ? true : undefined);

  if (status === "sent") {
    return (
      <div className="contact-form">
        <div className="terminal-success" role="status" aria-live="polite">
          <TermBar />
          <div className="term-body">
            <div className="line">
              <span className="prompt">vault@arcade:~$</span> ./send_message --to=team
            </div>
            <div className="line dim">[OK] Conectando con servidor…</div>
            <div className="line dim">[OK] Validando contenido…</div>
            <div className="line dim">[OK] Transmitiendo paquete…</div>
            {simulated ? (
              <div className="line dim">
                [DEV] RESEND_API_KEY no configurada · mensaje registrado en el servidor
              </div>
            ) : null}
            <div className="line success">
              &gt; MENSAJE RECIBIDO. TE RESPONDEREMOS PRONTO. GRACIAS, {form.name.trim().toUpperCase()}.
              <span className="caret">_</span>
            </div>
            <div style={{ marginTop: 18 }}>
              <button className="btn ghost" type="button" onClick={otroMensaje}>
                ENVIAR OTRO MENSAJE
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (status === "error") {
    return (
      <div className="contact-form">
        <div className="terminal-success error" role="alert">
          <TermBar />
          <div className="term-body">
            <div className="line">
              <span className="prompt">vault@arcade:~$</span> ./send_message --to=team
            </div>
            <div className="line fail">
              [ERROR] TRANSMISIÓN FALLIDA<span className="caret">_</span>
            </div>
            <div className="line">{errorMessage}</div>
            <div style={{ marginTop: 18 }}>
              <button className="btn ghost" type="button" onClick={reintentar}>
                REINTENTAR
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <form className={"contact-form" + (shake ? " shake" : "")} onSubmit={onSubmit} noValidate>
      <noscript>
        <p className="contact-noscript">
          El envío del formulario necesita JavaScript. Actívalo para escribirnos desde aquí.
        </p>
      </noscript>

      <div className="field">
        <label htmlFor="av-contact-name">Nombre</label>
        <input
          id="av-contact-name"
          value={form.name}
          onChange={set("name")}
          placeholder="px_kai"
          maxLength={MAX_NAME}
          autoComplete="name"
          aria-invalid={fallo("name")}
        />
      </div>

      <div className="field">
        <label htmlFor="av-contact-email">Correo electrónico</label>
        <input
          id="av-contact-email"
          type="email"
          value={form.email}
          onChange={set("email")}
          placeholder="jugador@vault.gg"
          maxLength={MAX_EMAIL}
          autoComplete="email"
          aria-invalid={fallo("email")}
        />
      </div>

      <div className="field">
        <div className="field-head">
          <label htmlFor="av-contact-msg">Mensaje</label>
          <span className="field-count">
            {form.msg.length}/{MAX_MSG}
          </span>
        </div>
        <textarea
          id="av-contact-msg"
          rows={5}
          value={form.msg}
          onChange={set("msg")}
          placeholder="Cuéntanos qué tienes en mente…"
          maxLength={MAX_MSG}
          aria-invalid={fallo("msg")}
        />
      </div>

      {/* Campo trampa. Fuera de la pantalla, nunca con display:none: un lector de
          pantalla lo salta por aria-hidden y un bot lo rellena igual. */}
      <div style={{ position: "absolute", left: "-9999px", top: "auto", width: 1, height: 1, overflow: "hidden" }}>
        <label htmlFor="av-contact-website">No rellenes este campo</label>
        <input id="av-contact-website" ref={website} name="website" type="text" tabIndex={-1} autoComplete="off" aria-hidden="true" />
      </div>

      <button className="btn xl press" type="submit" style={{ width: "100%" }} disabled={enviando}>
        {enviando ? "▶  ENVIANDO…" : "▶  ENVIAR MENSAJE"}
      </button>
    </form>
  );
}

/** Barra de la terminal VAULT-OS, igual en el estado de exito y en el de error. */
function TermBar() {
  return (
    <div className="term-bar" aria-hidden="true">
      <span className="dot r" />
      <span className="dot y" />
      <span className="dot g" />
      <span className="term-title">VAULT-OS // TERMINAL</span>
    </div>
  );
}
