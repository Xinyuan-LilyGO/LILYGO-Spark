/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: 'class',
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: 'rgb(var(--color-primary) / <alpha-value>)',
          hover: 'rgb(var(--color-primary-hover) / <alpha-value>)',
          muted: 'rgb(var(--color-primary-muted) / <alpha-value>)',
          'muted-bg': 'rgb(var(--color-primary-muted-bg) / <alpha-value>)',
        },
      },
    },
  },
  plugins: [],
}
