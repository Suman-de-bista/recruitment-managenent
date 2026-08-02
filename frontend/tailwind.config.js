/** @type {import('tailwindcss').Config} */
export default {
  darkMode: ["selector", '[data-theme="dark"]'],
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        paper: "rgb(var(--color-paper) / <alpha-value>)",
        ink: "rgb(var(--color-ink) / <alpha-value>)",
        "ink-muted": "rgb(var(--color-ink-muted) / <alpha-value>)",
        "ink-faint": "rgb(var(--color-ink-faint) / <alpha-value>)",
        hairline: "rgb(var(--color-hairline) / <alpha-value>)",
        surface: "rgb(var(--color-surface) / <alpha-value>)",
        accent: "rgb(var(--color-accent) / <alpha-value>)",
        "accent-soft": "rgb(var(--color-accent-soft) / <alpha-value>)",
        "accent-ink": "rgb(var(--color-accent-ink) / <alpha-value>)",
        status: {
          new: "rgb(var(--color-status-new) / <alpha-value>)",
          "new-soft": "rgb(var(--color-status-new-soft) / <alpha-value>)",
          reviewed: "rgb(var(--color-status-reviewed) / <alpha-value>)",
          "reviewed-soft": "rgb(var(--color-status-reviewed-soft) / <alpha-value>)",
          hired: "rgb(var(--color-status-hired) / <alpha-value>)",
          "hired-soft": "rgb(var(--color-status-hired-soft) / <alpha-value>)",
          rejected: "rgb(var(--color-status-rejected) / <alpha-value>)",
          "rejected-soft": "rgb(var(--color-status-rejected-soft) / <alpha-value>)",
          archived: "rgb(var(--color-status-archived) / <alpha-value>)",
          "archived-soft": "rgb(var(--color-status-archived-soft) / <alpha-value>)",
        },
        danger: "rgb(var(--color-danger) / <alpha-value>)",
      },
      fontFamily: {
        serif: ["\"Source Serif 4\"", "Georgia", "serif"],
        sans: ["Inter", "system-ui", "sans-serif"],
      },
    },
  },
  plugins: [],
};
