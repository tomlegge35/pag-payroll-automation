/** @type {import("next").NextConfig} */
const nextConfig = {
  // Moved from experimental.serverComponentsExternalPackages (deprecated in Next.js 14.1+)
  serverExternalPackages: ['pdf-parse'],
  env: {
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
  },
}

module.exports = nextConfig
