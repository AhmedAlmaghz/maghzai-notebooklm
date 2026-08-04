import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Tell Next.js NOT to bundle these native/server-only packages.
  // better-sqlite3 is only used locally; on Vercel we use PostgreSQL.
  serverExternalPackages: [
    "better-sqlite3",
    "pg",
    "bcryptjs",
    // OCR + image processing run in Node (serverless) and must not be bundled.
    "tesseract.js",
    "sharp",
    // pdfjs-dist must stay external so its worker file resolves correctly in Node.
    "pdfjs-dist",
    "@napi-rs/canvas",
  ],

  // Required to silence the Turbopack/webpack config mismatch error in Next.js 16
  turbopack: {},
};

export default nextConfig;
