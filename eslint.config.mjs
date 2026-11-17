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
  {
    // SOTA-Strict-Regeln (typed linting) fuer den Produktionscode. Tests sind
    // ausgenommen: sie laufen unter Vitest und sind in tsconfig nicht
    // typisiert; ihr Fixture-Setup (process.env) ist bewusst erlaubt.
    files: ['src/**/*.ts', 'src/**/*.tsx'],
    ignores: ['src/**/*.test.ts'],
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      // Vergessene awaits auf Server Actions/DB-Calls (Top-Fehlerquelle bei
      // async/await-Architektur) – floating Promises sind Build-Blocker.
      '@typescript-eslint/no-floating-promises': 'error',
      // any verbietet sich selbst (SOTA-Directive: 0 Loose Types).
      '@typescript-eslint/no-explicit-any': 'error',
      // async-Funktionen dort erlauben, wo void erwartet wird (Event-Handler,
      // useTransition-Callbacks), aber Promise-in-Promise-Fehler trotzdem
      // fangen (z. B. await in bedingten Ausdruecken).
      '@typescript-eslint/no-misused-promises': [
        'error',
        {
          checksVoidReturn: {
            arguments: false,
            attributes: false,
          },
        },
      ],
      // Verhindert versehentliche Wert- statt Referenz-Vergleiche auf
      // branded Types (SOTA-Directive: Domain-IDs).
      '@typescript-eslint/restrict-template-expressions': [
        'error',
        {
          allowNumber: true,
          allowBoolean: false,
          allowNullish: false,
        },
      ],
    },
  },
  {
    // Root-Layout: der Google-Fonts-<link> ist ein dokumentiertes False
    // Positive der Pages-Router-Regel no-page-custom-font – im App Router
    // gilt der Root-Layout-Link fuer ALLE Seiten. Mona Sans liegt ausserdem
    // nicht im next/font/google-Katalog dieser Next-Version, next/font/local
    // braeuchte Font-Binaries im Repo. Unterdrueckung bewusst, nicht still:
    // siehe AGENTS.md (Konventionen).
    files: ['src/app/layout.tsx'],
    rules: {
      '@next/next/no-page-custom-font': 'off',
    },
  },
]

export default eslintConfig
