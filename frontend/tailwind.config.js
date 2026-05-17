/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          50:  '#eff7ff',
          100: '#dbecff',
          200: '#bedeff',
          300: '#91c8ff',
          400: '#5da7ff',
          500: '#3884fc',
          600: '#1f63f1',
          700: '#1a4dde',
          800: '#1c41b4',
          900: '#1e3c8e',
          950: '#172657',
        },
      },
      boxShadow: {
        'card': '0 1px 2px rgba(15, 23, 42, 0.04), 0 4px 16px rgba(15, 23, 42, 0.04)',
        'card-hover': '0 2px 6px rgba(15, 23, 42, 0.06), 0 12px 28px rgba(15, 23, 42, 0.08)',
        'inner-ring': 'inset 0 0 0 1px rgba(15, 23, 42, 0.08)',
      },
      fontFamily: {
        sans: [
          '"Inter"',
          'ui-sans-serif',
          'system-ui',
          '-apple-system',
          'BlinkMacSystemFont',
          '"Segoe UI"',
          'sans-serif',
        ],
        display: [
          '"Inter"',
          'ui-sans-serif',
          'system-ui',
          'sans-serif',
        ],
      },
      animation: {
        'fade-in': 'fadeIn 0.4s ease-out',
        'slide-up': 'slideUp 0.35s cubic-bezier(0.16, 1, 0.3, 1)',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { opacity: '0', transform: 'translateY(8px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
      },
    },
  },
  plugins: [],
};
