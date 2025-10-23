/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,

  // Vercel-specific configuration
  serverRuntimeConfig: {
    maxDuration: 10, // 10 seconds for Hobby tier
  },
};

export default nextConfig;
