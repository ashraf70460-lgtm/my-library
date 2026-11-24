export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  darkMode: ['class'],
  theme: {
    extend: {
      colors: {
        ivory: 'rgb(var(--c-ivory) / <alpha-value>)',
        paper: 'rgb(var(--c-paper) / <alpha-value>)',
        card: 'rgb(var(--c-card) / <alpha-value>)',
        ink: 'rgb(var(--c-ink) / <alpha-value>)',
        muted: 'rgb(var(--c-muted) / <alpha-value>)',
        line: 'rgb(var(--c-line) / <alpha-value>)',
        forest: 'rgb(var(--c-forest) / <alpha-value>)',
        olive: 'rgb(var(--c-olive) / <alpha-value>)',
        brown: 'rgb(var(--c-brown) / <alpha-value>)',
        wine: 'rgb(var(--c-wine) / <alpha-value>)',
      },
      fontFamily: { serif: 'var(--f-serif)', sans: 'var(--f-sans)' },
    },
  },
  plugins: [],
};
