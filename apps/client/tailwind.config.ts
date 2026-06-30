import type { Config } from 'tailwindcss';

/**
 * Tailwind theme bound to the CSS variables in theme.css so utilities like
 * `bg-card` / `text-muted` resolve to the active light/dark token values.
 */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        bg: 'var(--bg)',
        sidebar: 'var(--sidebar)',
        card: 'var(--card)',
        border: 'var(--border)',
        hairline: 'var(--hairline)',
        text: 'var(--text)',
        muted: 'var(--muted)',
        muted2: 'var(--muted2)',
        faint: 'var(--faint)',
        accent: 'var(--accent)',
        'accent-soft': 'var(--accent-soft)',
        'accent-text': 'var(--accent-text)',
        'on-accent': 'var(--on-accent)',
        track: 'var(--track)',
        good: 'var(--good)',
        'good-soft': 'var(--good-soft)',
        chip: 'var(--chip)',
        input: 'var(--input)',
        star: 'var(--star)',
      },
      fontFamily: {
        display: ['Space Grotesk', 'sans-serif'],
        body: ['Hanken Grotesk', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
} satisfies Config;
