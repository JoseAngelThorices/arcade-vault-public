import type { NextConfig } from "next";

// Headers de seguridad en todas las respuestas (SPEC 14). La CSP la pone
// proxy.ts porque lleva un nonce por peticion (SEC-03).
const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-DNS-Prefetch-Control", value: "off" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=()" },
  // HSTS solo en produccion: en desarrollo se sirve por http desde la IP de la
  // red, y el navegador recordaria forzar https en ese host durante dos anos.
  ...(process.env.NODE_ENV === "production"
    ? [{ key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" }]
    : []),
];

const nextConfig: NextConfig = {
  // Sin la cabecera X-Powered-By: Next.js (SEC-03).
  poweredByHeader: false,
  // La app se abre en desarrollo por la IP de red; sin esto Next bloquea sus
  // recursos de dev para ese origen y React no llega a hidratar.
  allowedDevOrigins: ["192.168.0.*", "192.168.18.*"],
  headers: async () => [{ source: "/(.*)", headers: securityHeaders }],
};

export default nextConfig;
