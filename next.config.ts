import type { NextConfig } from "next"

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "raw.githubusercontent.com" },
      { protocol: "https", hostname: "*.supabase.co" },
    ],
  },
  webpack: (config) => {
    config.module.rules.push({
      test: /\.(glsl|vert|frag)$/,
      use: "raw-loader",
    })
    return config
  },
}

export default nextConfig
