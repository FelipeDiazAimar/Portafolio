/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ['@portafolio/ui', '@portafolio/config'],
  // The default trailing-slash redirect (e.g. "/playground/" -> "/playground")
  // fires before rewrites and can't be scoped to one path, which breaks direct
  // access to the Vite-built playground (canonical URL "/playground/", per its
  // "/playground/" base path). Skip that automatic redirect and handle both
  // slash forms ourselves via rewrites instead; this doesn't affect /api/*
  // routes, which were never redirected in the no-trailing-slash direction.
  skipTrailingSlashRedirect: true,
  async rewrites() {
    return [
      { source: '/playground', destination: '/playground/index.html' },
      { source: '/playground/', destination: '/playground/index.html' },
    ];
  },
};

module.exports = nextConfig;
