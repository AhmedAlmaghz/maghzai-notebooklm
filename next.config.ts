import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Tell Next.js NOT to bundle these native/server-only packages.
  // better-sqlite3 is only used locally; on Vercel we use PostgreSQL.
  serverExternalPackages: ["better-sqlite3", "pg", "bcryptjs"],

  // Required to silence the Turbopack/webpack config mismatch error in Next.js 16
  turbopack: {},
};

export default nextConfig;
