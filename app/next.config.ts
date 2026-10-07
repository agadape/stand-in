import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Pages read the database and chain at request time; classic dynamic rendering fits
  // better than Cache Components' Suspense/use-cache model for this app.
  cacheComponents: false,
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
