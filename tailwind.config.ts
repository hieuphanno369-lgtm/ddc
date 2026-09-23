import type { Config } from 'tailwindcss';

const config: Config = {
  // Toi khi CA HAI dieu kien: co [data-theme="dark"], HOAC he dieu hanh toi ma
  // khong bi [data-theme="light"] de len. Tailwind 3.4 cho phep mang format,
  // moi format bat buoc chua '&'.
  darkMode: [
    'variant',
    [
      '&:is([data-theme="dark"] *)',
      '@media (prefers-color-scheme: dark){&:not([data-theme="light"] *)}',
    ],
  ],
  content: ['./app/**/*.{ts,tsx}', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // --- He Apple Glass (nguon: app/tokens.css) ---
        // KHONG dung opacity modifier (text-label/60) - token la rgba tho.
        label: 'var(--label)',
        label2: 'var(--label2)',
        label3: 'var(--label3)',
        label4: 'var(--label4)',
        sep: 'var(--sep)',
        sep2: 'var(--sep-2)',
        base: 'var(--bg-base)',
        glass: 'var(--glass)',
        glass2: 'var(--glass-2)',
        glass3: 'var(--glass-3)',
        'glass-stroke': 'var(--glass-stroke)',
        fill: 'var(--fill)',
        fill2: 'var(--fill-2)',
        brand: 'var(--accent)',
        'brand-2': 'var(--accent-2)',
        'brand-deep': 'var(--accent-deep)',
        'brand-tint': 'var(--accent-tint)',
        gold: 'var(--gold)',
        ok: 'var(--ok)',
        'ok-fill': 'var(--ok-fill)',
        warn: 'var(--warn)',
        'warn-fill': 'var(--warn-fill)',
        danger: 'var(--danger)',
        'danger-fill': 'var(--danger-fill)',
        info: 'var(--info)',
        'info-fill': 'var(--info-fill)',

        // --- Di san: XOA o Task 12, giu tam de trang chua doi khong mat mau ---
        navy: {
          50: '#eef2f7', 100: '#d9e2ee', 200: '#b3c4da', 300: '#8aa5c4',
          400: '#4f729d', 500: '#204060', 600: '#12314f', 700: '#0e2741',
          800: '#0a1f3d', 900: '#071832', 950: '#04101f',
        },
        accent: { DEFAULT: '#B91C1C', soft: '#FEE2E2' },
        canvas: '#f5f7fa',
        offwhite: '#e8e4d9',
      },
      borderRadius: {
        xs: 'var(--r-xs)', sm: 'var(--r-sm)', md: 'var(--r-md)',
        lg: 'var(--r-lg)', xl: 'var(--r-xl)', '2xl': 'var(--r-2xl)',
        full: 'var(--r-full)', icon: 'var(--r-icon)',
        card: '16px', // di san - xoa o Task 12
      },
      boxShadow: {
        e0: 'var(--e0)', e1: 'var(--e1)', e2: 'var(--e2)',
        e3: 'var(--e3)', e4: 'var(--e4)',
        card: '0 1px 2px rgba(10,31,61,0.04), 0 4px 16px rgba(10,31,61,0.06)', // di san
        'card-hover': '0 6px 20px rgba(10,31,61,0.12)', // di san
      },
      fontSize: {
        caption2: 'var(--t-caption2)', caption1: 'var(--t-caption1)',
        footnote: 'var(--t-footnote)', subhead: 'var(--t-subhead)',
        callout: 'var(--t-callout)', body: 'var(--t-body)',
        title3: 'var(--t-title3)', title2: 'var(--t-title2)',
        title1: 'var(--t-title1)', large: 'var(--t-large)',
      },
      letterSpacing: {
        large: 'var(--tr-large)', title: 'var(--tr-title)', body: 'var(--tr-body)',
      },
      transitionTimingFunction: {
        ios: 'var(--ease-ios)', out: 'var(--ease-out)', std: 'var(--ease-std)',
      },
      transitionDuration: { fast: '180', base: '320', slow: '520' },
      backdropBlur: {
        ultrathin: 'var(--mat-ultrathin)', thin: 'var(--mat-thin)',
        regular: 'var(--mat-regular)', thick: 'var(--mat-thick)',
        chrome: 'var(--mat-chrome)',
      },
      fontFamily: {
        sans: [
          '-apple-system', 'BlinkMacSystemFont', 'SF Pro Display', 'SF Pro Text',
          'var(--font-inter)', 'system-ui', 'Segoe UI', 'sans-serif',
        ],
        mono: ['ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace'],
      },
    },
  },
  plugins: [],
};

export default config;
