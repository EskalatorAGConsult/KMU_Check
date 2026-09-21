import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  // Keep the bundled Tailwind Plus oatmeal template out of the build graph.
  outputFileTracingExcludes: {
    '*': ['./_oatmeal_template/**'],
  },
  // BAFA-Vollmachtvorlage + universelles Systemkonzept (AcroForm/PDF) muessen
  // im Serverless-Bundle der Journey- und Vorlagen-Routen landen.
  outputFileTracingIncludes: {
    '/v/*': ['./docs/vorlagen/*.pdf'],
    '/vorlagen/*': ['./docs/vorlagen/*.pdf'],
  },
  // Server-Action-Bodies (PDF-Uploads: Angebot, Systemkonzept, Dokumente)
  // sind per Default auf 1 MB begrenzt – Scans erreichen validiereUploadDatei
  // sonst nie (413 vor Ausfuehrung der Action). Grenze passend zum 15-MB-
  // Limit der Upload-Validierung (src/lib/admin/datei-upload.ts).
  experimental: {
    serverActions: {
      bodySizeLimit: '16mb',
    },
  },
}

export default nextConfig
