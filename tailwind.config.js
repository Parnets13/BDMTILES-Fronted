/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#fff7f0',
          100: '#ffece0',
          200: '#ffd4b8',
          300: '#ffb585',
          400: '#ff8a3d',
          500: '#FF5F03',
          600: '#E04F00',
          700: '#B84000',
          800: '#8a3000',
          900: '#5c2000',
        },
      },
    },
  },
  plugins: [],
};
