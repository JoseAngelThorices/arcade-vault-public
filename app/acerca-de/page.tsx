// Port de About de references/templates/home-about/home-about/about.jsx.
//
// La pantalla es un Server Component: lo unico que manda JavaScript al
// navegador es <ContactForm />, porque el envio lo necesita. El resto —heroe,
// destacados, separador y columna de contacto— es contenido estatico.
//
// El IntersectionObserver del prototipo no se porta: la animacion de entrada la
// lleva .reveal en globals.css con scroll-driven animations, por la misma razon
// que en el SPEC 02. Nada visible depende de que se ejecute JavaScript.

import type { Metadata } from "next";
import { HighlightIcon, type HighlightIconKind } from "@/components/about-icons";
import ContactForm from "@/components/contact-form";

export const metadata: Metadata = {
  title: "Acerca de · Arcade Vault",
  description:
    "Por qué existe Arcade Vault, qué nos mueve y cómo escribirnos para proponer un juego o mandarnos una sugerencia.",
};

type Highlight = { icon: HighlightIconKind; text: string; color: "cyan" | "magenta" | "green" };
type Tip = { text: string; led: "green" | "yellow" | "magenta" };

const HIGHLIGHTS: Highlight[] = [
  { icon: "HEART", text: "HECHO CON ❤️ PARA JUGADORES", color: "magenta" },
  { icon: "BROWSER", text: "JUEGOS EN HTML — CORREN EN CUALQUIER NAVEGADOR", color: "cyan" },
  { icon: "PLANT", text: "PROYECTO EN CONSTANTE CRECIMIENTO", color: "green" },
];

const TIPS: Tip[] = [
  { text: "RESPUESTA EN 24-48H", led: "green" },
  { text: "SUGERENCIAS BIENVENIDAS", led: "yellow" },
  { text: "SIN SPAM, JAMÁS", led: "magenta" },
];

/** El verde es la clase base; el amarillo y el magenta son sus modificadores. */
const LED_CLASS: Record<Tip["led"], string> = {
  green: "tip-led",
  yellow: "tip-led y",
  magenta: "tip-led m",
};

/** Piezas del separador de pixeles. Solo decoracion. */
const DIVIDER_PIXELS = Array.from({ length: 24 }, (_, i) => i);

export default function AcercaDePage() {
  return (
    <div className="about fade-in">
      <section className="about-hero">
        <div className="kicker pixel neon-yellow">▸ ACERCA DE</div>
        <h1 className="about-title">ACERCA DE ARCADE VAULT</h1>
        <p className="about-mission">
          ARCADE VAULT nació del amor por los videojuegos clásicos. Nuestra misión es preservar y celebrar los
          arcades que definieron una generación, haciéndolos accesibles para todos, en cualquier lugar y sin
          costo.
        </p>

        <div className="highlight-row">
          {HIGHLIGHTS.map((highlight, i) => (
            <div
              key={highlight.icon}
              className={`highlight ${highlight.color}`}
              style={{ transitionDelay: `${i * 80}ms` }}
            >
              <HighlightIcon kind={highlight.icon} />
              <div className="hl-text pixel">{highlight.text}</div>
            </div>
          ))}
        </div>
      </section>

      <div className="about-divider reveal" aria-hidden="true">
        <div className="div-bar" />
        <div className="div-pixels">
          {DIVIDER_PIXELS.map((i) => (
            <span key={i} style={{ animationDelay: `${i * 80}ms` }} />
          ))}
        </div>
        <div className="div-bar" />
      </div>

      <section className="about-contact reveal">
        <div className="contact-grid">
          <div className="contact-intro">
            <div className="kicker pixel neon-cyan">▸ CONTACTO</div>
            <h2 className="contact-title">CONTÁCTANOS</h2>
            <p className="contact-sub">
              ¿Tienes alguna sugerencia, quieres proponer un juego, o simplemente quieres saludar? Escríbenos.
            </p>
            <div className="contact-tips">
              {TIPS.map((tip) => (
                <div className="tip" key={tip.text}>
                  <span className={LED_CLASS[tip.led]} />
                  {tip.text}
                </div>
              ))}
            </div>
          </div>

          <ContactForm />
        </div>
      </section>
    </div>
  );
}
