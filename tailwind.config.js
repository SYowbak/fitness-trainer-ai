/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
    "./components/**/*.{js,ts,jsx,tsx}",
    "./pages/**/*.{js,ts,jsx,tsx}",
    "./hooks/**/*.{js,ts,jsx,tsx}",
    "./services/**/*.{js,ts,jsx,tsx}",
    "./utils/**/*.{js,ts,jsx,tsx}",
    "./*.{js,ts,jsx,tsx}"
  ],
  theme: {
    extend: {
      colors: {
        // Zoloto-chorona tema na osnovi logotipu
        'fitness': {
          'gold': {
            50: '#fffbeb',
            100: '#fef3c7',
            200: '#fde68a',
            300: '#fcd34d',
            400: '#fbbf24',
            500: '#f59e0b', // Основний золотий
            600: '#d97706',
            700: '#b45309',
            800: '#92400e',
            900: '#78350f',
          },
          'dark': {
            50: '#f8fafc',
            100: '#f1f5f9',
            200: '#e2e8f0',
            300: '#cbd5e1',
            400: '#94a3b8',
            500: '#64748b',
            600: '#475569',
            700: '#334155',
            800: '#1e293b', // Основний темний
            900: '#0f172a', // Найтемніший
            950: '#020617', // Майже чорний
          }
        },
        // Перевизначаємо стандартні кольори для теми
        primary: {
          50: '#fffbeb',
          100: '#fef3c7',
          200: '#fde68a',
          300: '#fcd34d',
          400: '#fbbf24',
          500: '#f59e0b',
          600: '#d97706',
          700: '#b45309',
          800: '#92400e',
          900: '#78350f',
        },
        secondary: {
          50: '#f8fafc',
          100: '#f1f5f9',
          200: '#e2e8f0',
          300: '#cbd5e1',
          400: '#94a3b8',
          500: '#64748b',
          600: '#475569',
          700: '#334155',
          800: '#1e293b',
          900: '#0f172a',
        }
      },
      backgroundImage: {
        'gradient-gold': 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
        'gradient-dark': 'linear-gradient(135deg, #000000 0%, #0f172a 100%)',
        'gradient-black': 'linear-gradient(135deg, #000000 0%, #111111 100%)',
        'gradient-black-glow': 'radial-gradient(ellipse at center, rgba(245, 158, 11, 0.03) 0%, rgba(245, 158, 11, 0.01) 50%, #000000 100%)',
        'gradient-gold-dark': 'linear-gradient(135deg, #f59e0b 0%, #1e293b 100%)',
      },
      boxShadow: {
        'gold': '0 4px 14px 0 rgba(245, 158, 11, 0.39)',
        'gold-lg': '0 10px 25px -3px rgba(245, 158, 11, 0.3), 0 4px 6px -2px rgba(245, 158, 11, 0.05)',
        'dark': '0 4px 14px 0 rgba(15, 23, 42, 0.39)',
        'dark-lg': '0 10px 25px -3px rgba(15, 23, 42, 0.3), 0 4px 6px -2px rgba(15, 23, 42, 0.05)',
      }
    },
  },
  plugins: [],
}