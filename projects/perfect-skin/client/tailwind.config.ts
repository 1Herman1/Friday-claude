import type { Config } from 'tailwindcss'

export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        background: '#F4F2EC',
        foreground: '#14202E',
        card: { DEFAULT: '#FFFFFF', foreground: '#14202E' },
        muted: { DEFAULT: '#EAE6DA', foreground: '#55606E' },
        primary: { DEFAULT: '#1F3A5F', foreground: '#F6F1E3' },
        accent: { DEFAULT: '#E4D3AC', foreground: '#14202E' },
        // Алиасы имён из статического макета: часть компонентов писалась по
        // ним. Значения = primary/primary-foreground, не новые цвета.
        'accent-ink': '#1F3A5F',
        'accent-text': '#F6F1E3',
        dark: { DEFAULT: '#16273D', foreground: '#ECE5D5' },
        border: { DEFAULT: '#D8D1BE', strong: '#8E8574' },
        gold: { text: '#7E5F26', mark: '#A87C2F', artwork: '#D6A75E' },
        urgency: { DEFAULT: '#A8531F', foreground: '#FFFFFF' },
        success: { DEFAULT: '#1F7A4D', foreground: '#FFFFFF' },
        destructive: { DEFAULT: '#B3261E', foreground: '#FFFFFF' },
        ring: '#1F3A5F',
      },
      fontFamily: {
        heading: ['Montserrat', 'system-ui', 'sans-serif'],
        sans: ['"Golos Text"', 'system-ui', 'sans-serif'],
      },
      fontSize: {
        display: 'clamp(1.6rem, 4.5vw, 4.5rem)',
        h2: 'clamp(1.75rem, 5vw, 3rem)',
        h3: 'clamp(1.25rem, 3vw, 2rem)',
        body: '16px',
        'body-sm': '14px',
        label: '11px',
        price: '18px',
      },
      lineHeight: {
        body: '1.6',
      },
      letterSpacing: {
        tight: '-0.03em',
        wide: '0.08em',
      },
      borderRadius: {
        pill: '999px',
        block: '16px',
        media: '12px',
      },
      outlineOffset: {
        2: '2px',
      },
      transitionTimingFunction: {
        out: 'cubic-bezier(0.23, 1, 0.32, 1)',
        'in-out': 'cubic-bezier(0.77, 0, 0.175, 1)',
      },
      transitionDuration: {
        160: '160ms',
        200: '200ms',
        300: '300ms',
      },
      maxWidth: {
        prose: '65ch',
      },
      screens: {
        xs: '320px',
        sm: '640px',
        md: '768px',
        lg: '1024px',
        xl: '1280px',
        '2xl': '1440px',
      },
      scale: {
        97: '0.97',
      },
    },
  },
  plugins: [],
} satisfies Config
