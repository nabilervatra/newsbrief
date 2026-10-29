import type { NextConfig } from "next";

// Fail the build (so the deploy, and `next dev`) on missing config, instead of shipping an app that 502s on every request.
for (const key of ["DATABASE_URL", "OPENAI_API_KEY", "GNEWS_API_KEY"]) {
  if (!process.env[key]) throw new Error(`Missing environment variable ${key}. See README.md, "Run locally".`);
}

const nextConfig: NextConfig = {
  /* config options here */
  cacheComponents: true,
  partialPrefetching: true,
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
