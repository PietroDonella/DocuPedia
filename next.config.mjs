/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // `pdf-parse` é uma biblioteca Node.js pura; garantimos que ela seja
  // tratada como pacote externo no runtime do servidor (evita bundling
  // do arquivo de teste interno da lib que causa erros de build).
  experimental: {
    serverComponentsExternalPackages: ["pdf-parse"],
  },
};

export default nextConfig;
