/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        ink: '#0F1B23',
        slate: {
          925: '#111C24',
        },
        clinical: {
          50: '#F1F7F6',
          100: '#DCEDEA',
          200: '#B9DBD4',
          300: '#8FC4BA',
          400: '#5FA79A',
          500: '#3D8A7D',
          600: '#2C6E64',
          700: '#235650',
          800: '#1D423F',
          900: '#173330',
        },
        amber: {
          500: '#C6862B',
        },
        rose: {
          500: '#B24343',
        },
      },
      fontFamily: {
        display: ['"Fraunces"', 'ui-serif', 'Georgia', 'serif'],
        sans: ['"Inter"', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        mono: ['"IBM Plex Mono"', 'ui-monospace', 'monospace'],
      },
    },
  },
  plugins: [],
};
