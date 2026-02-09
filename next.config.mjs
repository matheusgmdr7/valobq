/** @type {import('next').NextConfig} */
const nextConfig = {
  // Configuração simplificada para VALOREN
  output: process.env.NODE_ENV === 'production' ? 'standalone' : undefined,
  // Ignorar erros de tipo e ESLint no build de produção (verificados em dev)
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  experimental: {
    turbo: {
      rules: {
        '*.svg': {
          loaders: ['@svgr/webpack'],
          as: '*.js',
        },
      },
    },
  },
  webpack: (config, { isServer }) => {
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        path: false,
        crypto: false,
      };
    }
    
    return config;
  },
}

export default nextConfig
