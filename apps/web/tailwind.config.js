/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        primary: { DEFAULT: '#7C3AED', foreground: '#ffffff' },
        background: '#09090B',
        card: '#111116',
        border: '#1A1A24',
        muted: { DEFAULT: '#1A1A24', foreground: '#8B8BA0' },
        accent: { DEFAULT: '#1A1033', foreground: '#A78BFA' },
      },
    },
  },
  plugins: [],
}
