/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        yt: {
          dark: '#030303',
          card: '#161616',
          hover: '#262626',
          light: '#2a2a2a',
          red: '#ff0000',
          accent: '#ff0033',
          text: '#ffffff',
          subtext: '#aaaaaa',
          border: '#333333',
        }
      },
      fontFamily: {
        sans: ['"YouTube Sans"', 'Roboto', 'system-ui', '-apple-system', 'sans-serif'],
      },
      animation: {
        'pulse-subtle': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'spin-slow': 'spin 12s linear infinite',
      }
    },
  },
  plugins: [],
}
