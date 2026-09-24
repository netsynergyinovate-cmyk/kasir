import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  globalIgnores(['dist', '.vercel', '.claude', 'public']),
  {
    files: ['**/*.{js,jsx}'],
    extends: [
      js.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      globals: globals.browser,
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
    rules: {
      // Pola sinkron state dari URL/localStorage/props di dalam effect dipakai luas dan disengaja;
      // tetap dilaporkan sebagai peringatan, tidak memblokir lint.
      'react-hooks/set-state-in-effect': 'warn',
    },
  },
  {
    // API serverless, skrip, dan konfigurasi berjalan di Node, bukan browser
    files: ['api/**/*.js', 'scripts/**/*.js', 'tests/**/*.js', '*.config.js', 'vite-plugin-*.js'],
    languageOptions: { globals: globals.node },
  },
])
