/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'Segoe UI', 'sans-serif'],
        mono: ['ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace'],
      },
      colors: {
        // Public-data dashboard palette, carried over from the series'
        // shared visual language (blue/cyan ground, semantic risk colours).
        ink: {
          950: '#0a1220',
          900: '#0f1b2d',
          800: '#16263d',
          700: '#1f3352',
          600: '#2c456b',
        },
        surface: {
          DEFAULT: '#0f1b2d',
          raised: '#16263d',
          sunken: '#0a1220',
        },
      },
    },
  },
  plugins: [],
};
