import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/client/**/*.{ts,tsx,html}'],
  darkMode: 'class',
  theme: {
    extend: {
      fontFamily: {
        ui: 'var(--font-ui)',
        mono: 'var(--font-mono)',
        jp: 'var(--font-jp)',
      },
      colors: {
        bg0: 'var(--bg-0)',
        bg1: 'var(--bg-1)',
        bg2: 'var(--bg-2)',
        bg3: 'var(--bg-3)',
        inset: 'var(--bg-inset)',
        line: 'var(--line)',
        'line-strong': 'var(--line-strong)',
        fg0: 'var(--fg-0)',
        fg1: 'var(--fg-1)',
        fg2: 'var(--fg-2)',
        fg3: 'var(--fg-3)',
        accent: 'var(--accent)',
        cyan: 'var(--neon-cyan)',
        magenta: 'var(--neon-magenta)',
        amber: 'var(--neon-amber)',
        violet: 'var(--neon-violet)',
        danger: 'var(--danger)',
        success: 'var(--success)',
        warn: 'var(--warn)',
      },
      borderRadius: {
        token: 'var(--radius)',
        'token-lg': 'var(--radius-lg)',
      },
      boxShadow: {
        glow: 'var(--glow-accent)',
      },
    },
  },
  plugins: [],
};

export default config;
