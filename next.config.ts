import type { NextConfig } from "next";

// Headers de seguridad en todas las respuestas (SPEC 14). CSP y HSTS quedan
// para un spec propio.
const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-DNS-Prefetch-Control", value: "off" },
];

const nextConfig: NextConfig = {
  // La app se abre en desarrollo por la IP de red; sin esto Next bloquea sus
  // recursos de dev para ese origen y React no llega a hidratar.
  allowedDevOrigins: ["192.168.0.*", "192.168.18.*"],
  headers: async () => [{ source: "/(.*)", headers: securityHeaders }],
};

export default nextConfig;
