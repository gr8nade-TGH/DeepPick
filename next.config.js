/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverComponentsExternalPackages: ['@supabase/supabase-js', 'cheerio'],
  },
  images: {
    domains: ['images.unsplash.com', 'via.placeholder.com'],
  },
  // Webpack config to handle cheerio (server-side only)
  webpack: (config, { isServer }) => {
    if (isServer) {
      // Mark cheerio and its dependencies as external for server-side bundles
      config.externals = [...(config.externals || []), 'cheerio', 'undici'];
    }
    return config;
  },
  // Removed unused env variable
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          {
            key: 'X-Frame-Options',
            value: 'DENY',
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'Referrer-Policy',
            value: 'origin-when-cross-origin',
          },
        ],
      },
    ];
  },
};

module.exports = nextConfig;
