/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      fontFamily: {
        sans: [
          'Inter',
          'ui-sans-serif',
          'system-ui',
          '-apple-system',
          'Segoe UI',
          'Roboto',
          'Helvetica Neue',
          'Arial',
          'sans-serif',
        ],
      },
      colors: {
        brand: {
          50:  '#F9F4FF',
          100: '#ECE6FB',
          200: '#D9CDF8',
          300: '#D1B4FC',
          400: '#B89DFA',
          500: '#8B5CF6',
          600: '#5614BB',
          700: '#4510A0',
          800: '#350C7C',
          900: '#250858',
        },
        ink: {
          900: '#212529',
          700: '#495057',
          500: '#6C757D',
          300: '#CED4DA',
          200: '#DEE2E6',
          100: '#E9ECEF',
          50:  '#F8F9FA',
        },
      },
      boxShadow: {
        soft: '0 1px 2px rgba(33,37,41,0.04), 0 4px 12px rgba(86,20,187,0.06)',
        pop:  '0 10px 30px rgba(86,20,187,0.12)',
      },
      borderRadius: {
        xl: '14px',
        '2xl': '18px',
      },
    },
  },
  plugins: [],
}
