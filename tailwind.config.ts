import type { Config } from 'tailwindcss';

const config: Config = {
  darkMode: 'class',
  content: [
    './app/**/*.{ts,tsx}',
    './src/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        // Brand — trích từ logo DDC (navy trên off-white)
        navy: {
          50: '#eef2f7',
          100: '#d9e2ee',
          200: '#b3c4da',
          300: '#8aa5c4',
          400: '#4f729d',
          500: '#204060',
          600: '#12314f',
          700: '#0e2741',
          800: '#0a1f3d',
          900: '#071832',
          950: '#04101f',
        },
        accent: {
          DEFAULT: '#B91C1C',
          soft: '#FEE2E2',
        },
        gold: {
          DEFAULT: '#F5B301',
          soft: '#FEF3C7',
        },
        offwhite: '#e8e4d9',
        canvas: '#f5f7fa',
        // Semantics
        ok: '#16a34a',
        warn: '#f59e0b',
        danger: '#dc2626',
      },
      borderRadius: {
        card: '16px',
      },
      boxShadow: {
        card: '0 1px 2px rgba(10,31,61,0.04), 0 4px 16px rgba(10,31,61,0.06)',
        'card-hover': '0 6px 20px rgba(10,31,61,0.12)',
      },
      fontFamily: {
        sans: ['var(--font-inter)', 'system-ui', '-apple-system', 'Segoe UI', 'sans-serif'],
      },
    },
  },
  plugins: [],
};

export default config;
