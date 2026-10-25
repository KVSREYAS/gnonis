import type { NextConfig } from "next";
import { contentSecurityPolicy } from "./src/lib/runner/pyodide-config";

const nextConfig: NextConfig = {
  // The e2e accounts suite builds a second copy (Supabase switched on) into its own folder.
  distDir: process.env.NEXT_DIST_DIR || ".next",
  allowedDevOrigins: ["127.0.0.1"],
  serverExternalPackages: ["@vercel/sandbox"],
  outputFileTracingIncludes: {
    "/api/code/cpp": ["./content/courses/**/*"],
  },
  async headers() {
    const value = contentSecurityPolicy({
      dev: process.env.NODE_ENV !== "production",
      supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL,
    });
    return [{ source: "/:path*", headers: [{ key: "Content-Security-Policy", value }] }];
  },
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
