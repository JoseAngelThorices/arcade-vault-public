import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // La app se abre en desarrollo por la IP de red; sin esto Next bloquea sus
  // recursos de dev para ese origen y React no llega a hidratar.
  allowedDevOrigins: ["192.168.0.*"],
};

export default nextConfig;
