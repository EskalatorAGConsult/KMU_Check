import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  // Keep the bundled Tailwind Plus oatmeal template out of the build graph.
  outputFileTracingExcludes: {
    '*': ['./_oatmeal_template/**'],
  },
  // BAFA-Vollmachtvorlage (AcroForm) muss im Serverless-Bundle der Journey-
  // Seite landen, damit fuelleVollmachtAus() sie zur Laufzeit lesen kann.
  outputFileTracingIncludes: {
    '/v/*': ['./docs/vorlagen/*.pdf'],
  },
}

export default nextConfig
