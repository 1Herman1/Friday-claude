import type { Config } from 'tailwindcss'

const config: Config = {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        sand: {
          50: '#fdf8f0',
          100: '#faefd8',
          200: '#f4ddb0',
          300: '#ecc880',
          400: '#e2ad50',
          500: '#d4962e',
        },
        terra: {
          400: '#c17a5a',
          500: '#a8623e',
          600: '#8f4d2a',
        },
        olive: {
          400: '#8a9e6a',
          500: '#6b7f4a',
          600: '#52622f',
        },
      },
    },
  },
  plugins: [],
}

export default config
