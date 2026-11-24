import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Don't use standalone on Vercel — Vercel builds its own output.
  // (Vercel sets the VERCEL env var to "1" during build, so we can detect it.)
  output: process.env.VERCEL ? undefined : "standalone",
  typescript: {
    ignoreBuildErrors: true,
  },
  reactStrictMode: false,
};

export default nextConfig;
