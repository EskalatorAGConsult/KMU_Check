import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  // Keep the bundled Tailwind Plus oatmeal template out of the build graph.
  outputFileTracingExcludes: {
    '*': ['./_oatmeal_template/**'],
  },
}

export default nextConfig
