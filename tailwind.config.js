/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      fontFamily: {
        display: ['"Manrope"', 'sans-serif'],
        sans: ['"Manrope"', 'sans-serif'],
      },
      colors: {
        night: {
          950: '#060b16',
          900: '#0b1220',
          800: '#132035',
          700: '#1b2f4d',
        },
        cyan: {
          350: '#5ae4ff',
        },
        lime: {
          350: '#b6f36d',
        },
      },
      boxShadow: {
        panel: '0 30px 80px -40px rgba(8, 15, 35, 0.95)',
      },
      backgroundImage: {
        'panel-glow':
          'radial-gradient(circle at top, rgba(90, 228, 255, 0.16), transparent 42%), linear-gradient(180deg, rgba(15, 23, 42, 0.92), rgba(2, 6, 23, 0.84))',
      },
      keyframes: {
        float: {
          '0%, 100%': { transform: 'translateY(0px)' },
          '50%': { transform: 'translateY(-6px)' },
        },
      },
      animation: {
        float: 'float 8s ease-in-out infinite',
      },
    },
  },
  plugins: [],
}
