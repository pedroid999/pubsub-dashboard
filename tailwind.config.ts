import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/client/**/*.{ts,tsx,html}'],
  darkMode: 'class',
  theme: {
    extend: {},
  },
  plugins: [],
};

export default config;
