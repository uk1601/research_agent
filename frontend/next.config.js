/** @type {import('next').NextConfig} */

const nextConfig = {
  output: 'standalone',
  
  env: {
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000',
  },
  
  // Empty turbopack config to acknowledge we're using Turbopack
  // Path aliases are handled by tsconfig.json
  turbopack: {},
}

module.exports = nextConfig
