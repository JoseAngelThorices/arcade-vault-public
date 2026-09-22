// Port de Home de references/templates/home-about/home-about/home.jsx.
//
// La pagina es un Server Component y no manda ni una linea de JavaScript: los
// onClick={() => navigate(...)} del prototipo son aqui enlaces reales, y la
// animacion de entrada de las secciones la lleva .reveal en globals.css con
// scroll-driven animations, sin observador ni componente cliente.

import type { Metadata } from "next";
import Link from "next/link";
import { FeatureIcon, FloatingSilhouettes, type FeatureIconKind } from "@/components/home-icons";
import MiniCard from "@/components/mini-card";
import { GAMES } from "@/lib/games";

export const metadata: Metadata = {
  title: "Arcade Vault · El arcade clásico está de vuelta",
  description:
    "Juega los mejores clásicos arcade directamente en tu navegador. Sin descargas, sin costo, con ranking global.",
};

type NeonColor = "cyan" | "magenta" | "yellow" | "green";

type Feature = { icon: FeatureIconKind; title: string; desc: string; color: NeonColor };
type Stat = { n: string; u: string; s: string };
type Tick = { player: string; game: string; score: number; when: string; color: NeonColor };
type TopRow = { rank: number; player: string; score: number };

const FEATURES: Feature[] = [
  {
    icon: "GAMEPAD",
    title: "JUEGOS CLÁSICOS",
    desc: "Arkanoid, Tetris, Snake y muchos más. Los mejores arcades de todos los tiempos en un solo lugar.",
    color: "cyan",
  },
  {
    icon: "FREE",
    title: "100% GRATIS",
    desc: "Sin suscripciones, sin pagos ocultos. Todos los juegos disponibles de forma gratuita.",
    color: "yellow",
  },
  {
    icon: "TROPHY",
    title: "TABLAS DE RANKING",
    desc: "Compite con jugadores de todo el mundo. Escala el ranking y demuestra quién es el mejor.",
    color: "magenta",
  },
  {
    icon: "ROCKET",
    title: "SIEMPRE CRECIENDO",
    desc: "Agregamos nuevos juegos constantemente. Vuelve seguido, siempre habrá algo nuevo que jugar.",
    color: "green",
  },
];

// El prototipo anunciaba "12+" juegos; en lib/games.ts hay 8.
const STATS: Stat[] = [
  { n: "8", u: "JUEGOS", s: "Y CONTANDO" },
  { n: "MILES", u: "DE PARTIDAS", s: "JUGADAS CADA DÍA" },
  { n: "GLOBAL", u: "RANKING", s: "COMPITE CON EL MUNDO" },
];

// Actividad simulada: listas fijas, no hay backend detras.
const TICKER: Tick[] = [
  { player: "NEONFOX", game: "Caída", score: 184220, when: "hace 2 min", color: "magenta" },
  { player: "PX_KAI", game: "Glotón", score: 96400, when: "hace 5 min", color: "yellow" },
  { player: "Z3R0COOL", game: "Invasores", score: 54190, when: "hace 8 min", color: "green" },
  { player: "VAULT_07", game: "Rocas", score: 41200, when: "hace 12 min", color: "cyan" },
  { player: "GLITCHA", game: "Bloque Buster", score: 28450, when: "hace 18 min", color: "cyan" },
  { player: "ARKADYA", game: "Serpentina", score: 7820, when: "hace 24 min", color: "green" },
  { player: "CYBER_LU", game: "Ranaria", score: 18900, when: "hace 31 min", color: "yellow" },
];

const TOP_TODAY: TopRow[] = [
  { rank: 1, player: "NEONFOX", score: 312840 },
  { rank: 2, player: "PX_KAI", score: 248110 },
  { rank: 3, player: "M00NRYU", score: 196720 },
  { rank: 4, player: "VAULT_07", score: 154300 },
  { rank: 5, player: "GLITCHA", score: 138900 },
];

/** Las tres primeras filas del top llevan color de podio. */
const PODIUM = ["top1", "top2", "top3"];

export default function HomePage() {
  return (
    <div className="home fade-in">
      {/* HÉROE */}
      <section className="home-hero">
        <FloatingSilhouettes />
        <div className="home-hero-inner">
          <div className="hero-eyebrow pixel neon-yellow">
            ▸ INSERTA UNA MONEDA<span className="blink">_</span>
          </div>
          <h1 className="home-title">
            <span className="line-1">EL ARCADE</span>
            <span className="line-2">CLÁSICO ESTÁ</span>
            <span className="line-3">DE VUELTA</span>
          </h1>
          <p className="home-sub">
            Juega los mejores clásicos directamente en tu navegador.
            <br />
            Sin descargas. Sin costo. Solo diversión.
          </p>
          <div className="home-ctas">
            <Link className="btn xl pulse" href="/juegos">
              ▶ EXPLORAR JUEGOS
            </Link>
            <Link className="btn xl magenta" href="/acceso">
              ✦ CREAR CUENTA
            </Link>
          </div>
          <div className="hero-scroll" aria-hidden="true">
            <span>DESLIZA</span>
            <span className="arrow">▼</span>
          </div>
        </div>
      </section>

      {/* 01 · VENTAJAS */}
      <section className="reveal home-section">
        <div className="section-head">
          <div className="kicker pixel neon-magenta">{"// 01"}</div>
          <h2 className="section-title">¿POR QUÉ ARCADE VAULT?</h2>
          <div className="section-rule" />
        </div>
        <div className="feature-grid">
          {FEATURES.map((feature, i) => (
            <div
              key={feature.title}
              className={"feature-card " + feature.color}
              style={{ transitionDelay: `${i * 80}ms` }}
            >
              <FeatureIcon kind={feature.icon} />
              <div className="ft-title pixel">{feature.title}</div>
              <div className="ft-desc">{feature.desc}</div>
            </div>
          ))}
        </div>
      </section>

      {/* 02 · AVANCE DE JUEGOS */}
      <section className="reveal home-section">
        <div className="section-head">
          <div className="kicker pixel neon-cyan">{"// 02"}</div>
          <h2 className="section-title">JUEGOS DISPONIBLES AHORA</h2>
          <div className="section-rule" />
        </div>
        <div className="mini-rail">
          {GAMES.slice(0, 6).map((game) => (
            <MiniCard key={game.id} game={game} />
          ))}
        </div>
        <div style={{ textAlign: "center", marginTop: 24 }}>
          <Link className="btn lg" href="/juegos">
            VER TODOS LOS JUEGOS →
          </Link>
        </div>
      </section>

      {/* ESTADÍSTICAS */}
      <section className="reveal home-stats">
        <div className="stats-inner">
          {STATS.map((stat, i) => (
            <div key={stat.u} className="stat-block" style={{ transitionDelay: `${i * 90}ms` }}>
              <div className="stat-n neon-yellow">{stat.n}</div>
              <div className="stat-u pixel">{stat.u}</div>
              <div className="stat-s">{stat.s}</div>
            </div>
          ))}
        </div>
      </section>

      {/* 03 · ACTIVIDAD */}
      <section className="reveal home-section">
        <div className="section-head">
          <div className="kicker pixel neon-yellow">{"// 03"}</div>
          <h2 className="section-title">ACTIVIDAD EN VIVO</h2>
          <div className="section-rule" />
        </div>
        <div className="activity-grid">
          <div className="activity-card">
            <div className="ac-head">
              <div className="ac-title pixel">▸ ÚLTIMAS PUNTUACIONES</div>
            </div>
            <div className="ticker">
              {TICKER.map((row, i) => (
                <div key={row.player} className="tick-row" style={{ animationDelay: `${i * 60}ms` }}>
                  <span className={"tk-p neon-" + row.color}>{row.player}</span>
                  <span className="tk-mid">▸ {row.game}</span>
                  <span className="tk-s">+{row.score.toLocaleString("es-ES")}</span>
                  <span className="tk-t">{row.when}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="activity-card">
            <div className="ac-head">
              <div className="ac-title pixel neon-magenta">▸ TOP JUGADORES · HOY</div>
              <Link className="lb-link" href="/salon">
                VER SALÓN →
              </Link>
            </div>
            <div className="top-list">
              {TOP_TODAY.map((row, i) => (
                <div key={row.player} className={["top-row", PODIUM[i]].filter(Boolean).join(" ")}>
                  <span className="tp-rk">#{String(row.rank).padStart(2, "0")}</span>
                  <span className="tp-bar">
                    <span className="tp-fill" style={{ width: `${100 - i * 16}%` }} />
                  </span>
                  <span className="tp-p">{row.player}</span>
                  <span className="tp-s">{row.score.toLocaleString("es-ES")}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* 04 · PRECIOS */}
      <section className="reveal home-section">
        <div className="section-head">
          <div className="kicker pixel neon-green">{"// 04"}</div>
          <h2 className="section-title">PRECIOS</h2>
          <div className="section-rule" />
        </div>
        <div className="pricing-grid">
          <div className="price-card">
            <div className="pc-label pixel">PLAN ÚNICO</div>
            <div className="pc-name pixel">JUGADOR VAULT</div>
            <div className="pc-amount">
              <span className="pc-amount-n">0 €</span>
              <span className="pc-amount-u">/ SIEMPRE</span>
            </div>
            <div className="pc-tag">SIN TRUCOS · SIN LETRA PEQUEÑA</div>
            <ul className="pc-list">
              <li>✔ Acceso a todos los juegos</li>
              <li>✔ Ranking global y salón de la fama</li>
              <li>✔ Sin anuncios entre partidas</li>
              <li>✔ Guarda tus puntuaciones</li>
              <li>✔ Nuevos juegos cada mes</li>
              <li>✔ Funciona en cualquier navegador</li>
            </ul>
            <Link className="btn xl pulse" style={{ width: "100%" }} href="/acceso">
              EMPEZAR GRATIS →
            </Link>
            <div className="pc-foot">No pedimos tarjeta. Nunca lo haremos.</div>
            <div className="pc-stamp pixel">
              FREE
              <br />
              PLAY
            </div>
          </div>

          <div className="pricing-faq">
            <div className="faq-item">
              <div className="faq-q pixel">¿REALMENTE ES GRATIS?</div>
              <div className="faq-a">
                Sí. Arcade Vault es un proyecto sin fines de lucro hecho por amor a los clásicos. No
                hay versión «premium» escondida.
              </div>
            </div>
            <div className="faq-item">
              <div className="faq-q pixel">¿NECESITO CREAR CUENTA?</div>
              <div className="faq-a">
                No. Puedes jugar como invitado. Si quieres guardar tu puntuación y aparecer en el
                ranking, regístrate en 10 segundos.
              </div>
            </div>
            <div className="faq-item">
              <div className="faq-q pixel">¿CÓMO SOBREVIVEN SIN COBRAR?</div>
              <div className="faq-a">
                Es un proyecto comunitario. Si te gusta, compártelo. Esa es toda la moneda que
                aceptamos.
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CIERRE */}
      <section className="reveal home-final">
        <h2 className="final-title pixel">¿LISTO PARA JUGAR?</h2>
        <Link className="btn xl pulse final-cta" href="/juegos">
          INSERTAR MONEDA →
        </Link>
        <div className="final-tag">Gratis. Sin registro obligatorio. Empieza en segundos.</div>
      </section>
    </div>
  );
}
