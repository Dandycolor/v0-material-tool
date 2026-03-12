/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  images: {
    unoptimized: true,
  },
  turbopack: {
    root: '/vercel/share/v0-next-shadcn',
  },
}

export default nextConfig
