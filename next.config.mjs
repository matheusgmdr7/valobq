/** @type {import('next').NextConfig} */
const nextConfig = {
  // Configuração simplificada para VALOREN
  output: process.env.NODE_ENV === 'production' ? 'standalone' : undefined,
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
    // Com SINGLE_FILE=1, o WASM está embutido no JS, não precisa de configurações específicas para .wasm
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
  // Desabilitar otimizações que podem causar problemas com Turbopack
  swcMinify: true,
}

export default nextConfig
