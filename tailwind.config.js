/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './app/**/*.{vue,js,ts}',
    './components/**/*.{vue,js,ts}',
    './pages/**/*.{vue,js,ts}',
  ],
  theme: {
    extend: {
      colors: {
        accent: '#E8873A',
        border: '#E5E3DF',
        muted: '#666666',
        // UI kit v1 (docs/ui-kit/UI.md), prefixe `ui` pour ne pas entrer en
        // collision avec `accent`, `border` et `muted` ci-dessus (utilises par les
        // pages existantes). Usage : bg-ui-accent, text-ui-ink-2, border-ui-line...
        ui: {
          bg: '#F7F6F3',
          surface: '#FFFFFF',
          subtle: '#F3F1EC',
          line: { DEFAULT: '#E7E4DE', input: '#E2DED6', soft: '#EFECE6' },
          ink: { DEFAULT: '#1A1917', 2: '#4A4741', muted: '#6B675F' },
          accent: { DEFAULT: '#B9531A', hover: '#8F3F12', soft: '#FBEFE6', ink: '#8F3F12' },
          success: { DEFAULT: '#2F7A4D', soft: '#EAF4EE', ink: '#1F5636' },
          info: { DEFAULT: '#2B5FAA', soft: '#E8EEF8', ink: '#23497F' },
          danger: { DEFAULT: '#B42318', soft: '#FCEDEC', ink: '#8A1C12', line: '#F4C7C2' },
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'Helvetica Neue', 'Arial'],
        // UI kit : Geist seulement dans les composants Ui*, pas sur toute
        // l application, tant que les pages ne sont pas migrees.
        ui: ['Geist', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        'ui-mono': ['"Geist Mono"', 'ui-monospace', 'monospace'],
      },
      borderRadius: {
        card: '12px',
        // UI kit : prefixe `ui-` car `card` existe deja (12 px) avec un autre rayon.
        'ui-tag': '6px',
        'ui-ctl': '10px',
        'ui-card': '14px',
      },
    },
  },
  plugins: [],
}
