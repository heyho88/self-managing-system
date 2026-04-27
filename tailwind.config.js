/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  darkMode: 'class',
  theme: {
    borderRadius: {
      none: '0',
      DEFAULT: '0',
      sm: '0',
      md: '0',
      lg: '0',
      xl: '0',
      '2xl': '0',
      '3xl': '0',
      full: '0',
    },
    extend: {
      colors: {
        bg: 'var(--c-bg)',
        panel: 'var(--c-panel)',
        line: 'var(--c-line)',
        ink: 'var(--c-ink)',
        sub: 'var(--c-sub)',
        hover: 'var(--c-hover)',
        accent: 'var(--c-accent)',
        muted: 'var(--c-muted)',
        cat: {
          red: '#d44c47',
          orange: '#d98e3f',
          yellow: '#c9b443',
          green: '#5a8f5a',
          blue: '#4a7aa8',
          navy: '#3f5b8c',
          purple: '#7d5a8c',
          gray: '#8a8a85',
        },
      },
      fontFamily: {
        sans: [
          'Inter',
          'Pretendard',
          '-apple-system',
          'BlinkMacSystemFont',
          'system-ui',
          'sans-serif',
        ],
        mono: ['ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace'],
      },
      fontSize: {
        xs: ['11px', '14px'],
        sm: ['12px', '16px'],
        base: ['13px', '18px'],
        md: ['14px', '20px'],
        lg: ['16px', '22px'],
        xl: ['18px', '24px'],
        '2xl': ['20px', '26px'],
      },
      boxShadow: {
        none: 'none',
      },
    },
  },
  plugins: [],
};
