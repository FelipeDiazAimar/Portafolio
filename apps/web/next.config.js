/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ['@portafolio/ui', '@portafolio/config'],
  // La sección Contacto vive en la página principal (#contacto); la ruta vieja, con un formulario
  // que enviaba a un endpoint inexistente, redirige ahí.
  async redirects() {
    return [{ source: '/contacto', destination: '/#contacto', permanent: false }];
  },
};

module.exports = nextConfig;
