import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        // Cores da paleta VALOREN
        'valoren-black': '#000000',
        'valoren-dark': '#2e3851',
        'valoren-white': '#ffffff',
        'valoren-gray': '#767676',
        'valoren-green': '#10b981',
        'valoren-red': '#ef4444',
      },
      fontFamily: {
        'platform': ['platformdefault', 'sans-serif'],
        'times': ['Times', 'serif'],
      },
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
      }
    },
  },
  plugins: [],
}

export default config
