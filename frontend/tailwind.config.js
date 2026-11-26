/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  // hover styles only on devices with a real pointer (Mac/desktop). On phones a tap would
  // otherwise leave the hover look "stuck" on the tapped element.
  future: {
    hoverOnlyWhenSupported: true,
  },
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
        },
        // surfaces for the dark theme (base stays #030303)
        surface: {
          1: '#0e0e0f',
          2: '#161618',
          3: '#1e1e21',
          4: '#28282c',
        },
      },
      fontFamily: {
        sans: ['"YouTube Sans"', 'Roboto', 'system-ui', '-apple-system', 'sans-serif'],
      },
      boxShadow: {
        sheet: '0 -12px 40px rgba(0,0,0,0.55)',
        float: '0 10px 30px -8px rgba(0,0,0,0.7)',
      },
      animation: {
        'pulse-subtle': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'spin-slow': 'spin 12s linear infinite',
      },
    },
  },
  plugins: [],
}
