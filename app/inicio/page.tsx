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
import { timeAgo } from "@/lib/format";
import { getRecentActivity, getTopPlayersToday } from "@/lib/supabase/activity";
import { getGames } from "@/lib/supabase/games";

export const metadata: Metadata = {
  title: "Arcade Vault · El arcade clásico está de vuelta",
  description:
    "Juega los mejores clásicos arcade directamente en tu navegador. Sin descargas, sin costo, con ranking global.",
};

type NeonColor = "cyan" | "magenta" | "yellow" | "green";

type Feature = { icon: FeatureIconKind; title: string; desc: string; color: NeonColor };
type Stat = { n: string; u: string; s: string };

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

// El prototipo anunciaba "12+" juegos; aquí se cuentan los que hay en Supabase.
const statsFor = (gameCount: number): Stat[] => [
  { n: String(gameCount), u: "JUEGOS", s: "Y CONTANDO" },
  { n: "MILES", u: "DE PARTIDAS", s: "JUGADAS CADA DÍA" },
  { n: "GLOBAL", u: "RANKING", s: "COMPITE CON EL MUNDO" },
];

// Actividad real (Supabase): filas del ticker y del top del dia.
const TICKER_SIZE = 7;
const TOP_SIZE = 5;

const NEON_COLORS: NeonColor[] = ["cyan", "magenta", "yellow", "green"];

/** El color del juego en `games.color`, o cian si no es uno de los neones. */
const neonOf = (color: string | undefined): NeonColor =>
  NEON_COLORS.includes(color as NeonColor) ? (color as NeonColor) : "cyan";

/** Alias con enlace al perfil si la fila tiene cuenta; si no, texto plano. */
function PlayerName({
  username,
  fallback,
  className,
}: {
  username: string | null | undefined;
  fallback: string;
  className: string;
}) {
  if (!username) return <span className={className}>{fallback}</span>;
  return (
    <Link className={className} href={`/jugador/${username}`}>
      {username}
    </Link>
  );
}

/** Las tres primeras filas del top llevan color de podio. */
const PODIUM = ["top1", "top2", "top3"];

export default async function HomePage() {
  const [games, recent, topToday] = await Promise.all([
    getGames(),
    getRecentActivity(TICKER_SIZE),
    getTopPlayersToday(TOP_SIZE),
  ]);
  // Hora de la peticion: los "hace N min" se calculan en el servidor.
  const now = new Date().getTime();
  const topMax = topToday[0]?.total || 1;

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
          {games.slice(0, 6).map((game) => (
            <MiniCard key={game.id} game={game} />
          ))}
        </div>
      </section>

      {/* ESTADÍSTICAS */}
      <section className="reveal home-stats">
        <div className="stats-inner">
          {statsFor(games.length).map((stat, i) => (
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
              {recent.length === 0 ? (
                <p className="activity-empty">Todavía no hay partidas guardadas. ¡Estrena el marcador!</p>
              ) : (
                recent.map((row, i) => (
                  <div key={row.id} className="tick-row" style={{ animationDelay: `${i * 60}ms` }}>
                    <PlayerName
                      className={"tk-p neon-" + neonOf(row.games?.color)}
                      username={row.profiles?.username}
                      fallback={row.player_name}
                    />
                    <span className="tk-mid">▸ {row.games?.title ?? "—"}</span>
                    <span className="tk-s">+{row.score.toLocaleString("es-ES")}</span>
                    <span className="tk-t">{timeAgo(row.created_at, now)}</span>
                  </div>
                ))
              )}
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
              {topToday.length === 0 ? (
                <p className="activity-empty">Nadie ha puntuado hoy todavía. ¡Sé el primero!</p>
              ) : (
                topToday.map((row, i) => (
                  <div
                    key={row.user_id ?? `guest:${row.player_name}`}
                    className={["top-row", PODIUM[i]].filter(Boolean).join(" ")}
                  >
                    <span className="tp-rk">#{String(i + 1).padStart(2, "0")}</span>
                    <span className="tp-bar">
                      <span className="tp-fill" style={{ width: `${Math.round((row.total / topMax) * 100)}%` }} />
                    </span>
                    <PlayerName className="tp-p" username={row.username} fallback={row.player_name} />
                    <span className="tp-s">{row.total.toLocaleString("es-ES")}</span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </section>

      {/* CIERRE */}
      <section className="reveal home-final">
        <h2 className="final-title pixel">¿LISTO PARA JUGAR?</h2>
        <div className="final-actions">
          <Link className="btn xl pulse final-cta" href="/juegos">
            JUGAR SIN REGISTRARTE →
          </Link>
          <Link className="btn xl magenta final-cta" href="/acceso?registro">
            CREAR CUENTA
          </Link>
        </div>
        <div className="final-tag">
          Gratis. Juega como invitado o crea tu cuenta para guardar tus puntuaciones en el ranking.
        </div>
      </section>
    </div>
  );
}
