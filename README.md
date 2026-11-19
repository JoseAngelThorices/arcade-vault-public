# Arcade Vault

Plataforma de juegos arcade en el navegador donde los jugadores compiten por la puntuación más alta. Cinco juegos clásicos hechos desde cero en canvas 2D, con clasificaciones en tiempo real, perfiles de jugador, controles táctiles en móvil y sonido sintetizado.

Hecha con **Next.js 16**, **React 19**, **Tailwind CSS v4** y **Supabase**, siguiendo un flujo de trabajo guiado por specs.

## Juegos

| Juego | Categoría | De qué va |
|---|---|---|
| **Asteroids** | Shooter | Pulveriza rocas en gravedad cero. |
| **Tetris** | Puzzle | Apila piezas antes de que el techo te aplaste. |
| **Arkanoid** | Arcade | Rebota la bola y revienta el muro de neón. |
| **Snake** | Arcade | Come fruta, crece y no te muerdas la cola. |
| **Frogger** | Maze | Cruza la carretera y el río sin convertirte en papilla. |

Cada juego tiene tres skins (NEÓN, RETRO y CLÁSICO), pausa, gamepad táctil en móvil y efectos de sonido.

## Funcionalidades

- **Biblioteca y detalle de cada juego**, con el top 10 de su clasificación.
- **Salón de la fama**: la mejor marca de cada jugador por juego, con scroll infinito.
- **Actividad en vivo** en la portada: últimas partidas y mejores jugadores del día.
- **Cuentas** con correo y contraseña (Supabase Auth): confirmación por correo, recuperación de contraseña y política de contraseña robusta.
- **Perfil público** (`/jugador/<alias>`): alias único, avatar pixel art, mejores marcas, puesto en cada juego y últimas partidas.
- **Modo invitado**: 10 partidas gratis al día sin cuenta. Guardar puntuaciones exige iniciar sesión.
- **Controles táctiles**: gamepad virtual en móvil para todos los juegos.
- **Sonido** sintetizado con WebAudio (sin ficheros de audio), con silencio global (tecla `M`).
- **Formulario de contacto** que envía correo con Resend.

## Seguridad

- **Puntuaciones validadas en el servidor.** El cliente nunca escribe en la tabla de puntuaciones. Cada partida se abre en el servidor (`start_run`) y se cierra una sola vez (`submit_score`), con topes por juego y por tiempo jugado.
- **RLS en todas las tablas**: lectura pública y ninguna escritura directa desde el navegador. Los cambios pasan por funciones RPC que validan cada dato.
- **Cabeceras HTTP**: CSP con nonce por petición, HSTS en producción, `X-Frame-Options`, `Permissions-Policy`, etc.
- **Secretos solo en el servidor.** Los módulos que los usan llevan `import "server-only"`, y al navegador solo llega la clave publicable de Supabase.
- **Límites de uso**: límite de peticiones en el contacto (por IP y global), y en las partidas por usuario.

El informe de la auditoría de seguridad y sus correcciones está en [`references/security/`](references/security/).

## Stack

| | |
|---|---|
| Framework | Next.js 16 (App Router, Turbopack), React 19, TypeScript estricto |
| Estilos | Tailwind CSS v4 + estética neón/CRT propia |
| Datos y auth | Supabase (Postgres, RLS, RPC, Auth) |
| Correo | Resend |
| Juegos | Canvas 2D, sin librerías de juego |

## Estructura

```
app/                 rutas (App Router) y Route Handlers (/api/contact, /api/credits)
components/          interfaz y reproductores de los juegos (<id>-player.tsx)
components/games/    motores canvas de cada juego (<id>-game.tsx)
lib/                 Supabase, sesión, audio, skins, créditos, validaciones
proxy.ts             sesión de Supabase, CSP con nonce y rutas protegidas
public/              avatares y assets de los juegos
specs/               un spec por funcionalidad (01–16)
references/          prototipo original, juegos de partida e informes
```

Cada juego se divide en un **motor** canvas que solo dibuja y avisa del estado mediante callbacks, y un **reproductor** React que pinta el HUD, la pausa y el modal de fin de partida, y guarda la puntuación.

## Puesta en marcha

Requisitos: Node.js 20.9+ y un proyecto de Supabase.

```bash
npm install
cp specs/.env.template .env.local   # y rellena las variables
npm run dev                         # http://localhost:3000
```

Variables de `.env.local`:

| Variable | Para qué |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | URL del proyecto de Supabase |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Clave publicable de Supabase (nunca la secreta) |
| `CREDITS_SECRET` | Firma de la cookie de créditos de invitado (16+ caracteres) |
| `RESEND_API_KEY` | Clave de Resend. Vacía, el contacto funciona en modo simulación |
| `CONTACT_TO` / `RESEND_FROM` | Destinatario y remitente del formulario de contacto |
| `TRUSTED_PROXY_HOPS` | Número de proxies propios delante de la app (límite por IP) |

> El esquema de la base de datos (tablas, políticas RLS, funciones y triggers) no está incluido como migraciones en este repo. Está descrito en los specs 06, 13, 14 y 15.

## Comandos

```bash
npm run dev      # servidor de desarrollo (Turbopack)
npm run build    # build de producción
npm start        # sirve el build de producción
npm run lint     # ESLint
npx tsc --noEmit # comprobación de tipos
```

## Cómo se ha construido

El proyecto se ha desarrollado con [Claude Code](https://claude.com/claude-code) mediante **Spec Driven Design**: cada funcionalidad empieza como un spec en [`specs/`](specs/) (objetivo, plan, criterios de aceptación y decisiones), se implementa paso a paso y se cierra marcándolo como implementado. Las skills `/spec` y `/spec-impl` siguen las prácticas de [Klerith/fernando-skills](https://github.com/Klerith/fernando-skills):

```bash
npx skills@latest add Klerith/fernando-skills
```

En [`.claude/`](.claude/) hay además agentes propios del proyecto: planificar el siguiente juego, auditar skins, portar a móvil, optimizar el rendimiento de los motores y auditar la seguridad.

## Licencia

[MIT](LICENSE)
