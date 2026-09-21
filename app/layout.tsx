import type { Metadata, Viewport } from "next";
import { Courier_Prime, JetBrains_Mono, Press_Start_2P } from "next/font/google";
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
        <div className="av-root">{children}</div>
      </body>
    </html>
  );
}
