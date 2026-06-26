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
        background: 'rgb(var(--color-bg-base) / <alpha-value>)',
        surface: {
          DEFAULT: 'rgb(var(--color-bg-surface) / <alpha-value>)',
          hover: 'rgb(var(--color-bg-surface-hover) / <alpha-value>)',
        },
        // Semantic foreground token — themed per pack. Use alpha modifiers for
        // muted text (text-ink/60) and hairline borders (border-ink/10).
        ink: 'rgb(var(--color-text-base) / <alpha-value>)',
        primary: {
          DEFAULT: 'rgb(var(--color-primary) / <alpha-value>)',
          hover: 'rgb(var(--color-primary-hover) / <alpha-value>)',
          muted: 'rgb(var(--color-primary-muted) / <alpha-value>)',
          'muted-bg': 'rgb(var(--color-primary-muted-bg) / <alpha-value>)',
        },
        accent: {
          DEFAULT: 'rgb(var(--color-accent) / <alpha-value>)',
        }
      },
      borderRadius: {
        // Honors the active theme pack's shape language (--radius).
        theme: 'var(--radius)',
      },
    },
  },
  plugins: [],
}
