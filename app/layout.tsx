import type { Metadata, Viewport } from "next";
import { Courier_Prime, JetBrains_Mono, Press_Start_2P } from "next/font/google";
import Nav from "@/components/nav";
import { CreditsProvider } from "@/lib/credits-client";
import { SessionProvider } from "@/lib/session";
import "./globals.css";

const pressStart2P = Press_Start_2P({
  variable: "--font-press-start",
  subsets: ["latin"],
  weight: "400",
  display: "swap",
});

const jetBrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains-mono",
  subsets: ["latin"],
  display: "swap",
});

const courierPrime = Courier_Prime({
  variable: "--font-courier-prime",
  subsets: ["latin"],
  weight: ["400", "700"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Arcade Vault · Portal Retro",
  description:
    "Juega clásicos arcade, registra tu puntuación y entra en el Salón de la Fama.",
};

export const viewport: Viewport = {
  themeColor: "#0a0a0f",
  colorScheme: "dark",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="es"
      className={`${pressStart2P.variable} ${jetBrainsMono.variable} ${courierPrime.variable}`}
    >
      <body>
        <div className="av-bg" aria-hidden="true" />
        <div className="av-noise" aria-hidden="true" />
        <SessionProvider>
          <CreditsProvider>
            <div className="av-root">
              <Nav />
              <main className="av-main">{children}</main>
              <footer className="av-footer">
                © 2026 ARCADE VAULT · HECHO CON PIXELES Y NEÓN · v2.6.0
              </footer>
            </div>
          </CreditsProvider>
        </SessionProvider>
      </body>
    </html>
  );
}
