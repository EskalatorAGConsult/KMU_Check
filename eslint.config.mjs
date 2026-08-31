import nextVitals from 'eslint-config-next/core-web-vitals'
import nextTs from 'eslint-config-next/typescript'

// Flat Config (ESLint 9): eslint-config-next liefert native Flat-Configs,
// FlatCompat ist damit ueberfluessig (und war die Ursache des zirkulaeren
// Config-Fehlers).
const eslintConfig = [
  ...nextVitals,
  ...nextTs,
  {
    ignores: ['_oatmeal_template/**', '.next/**', 'supabase/**', 'scripts/**'],
  },
]

export default eslintConfig
