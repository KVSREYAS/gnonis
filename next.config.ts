import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The e2e accounts suite builds a second copy (Supabase switched on) into its own folder.
  distDir: process.env.NEXT_DIST_DIR || ".next",
  allowedDevOrigins: ["127.0.0.1"],
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
