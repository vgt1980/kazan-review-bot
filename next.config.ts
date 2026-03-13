import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Remove standalone for Vercel deployment
  // output: "standalone",
  /* config options here */
  typescript: {
    ignoreBuildErrors: true,
  },
  reactStrictMode: false,
};

export default nextConfig;
