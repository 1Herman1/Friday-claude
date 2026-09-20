import type { Config } from 'tailwindcss'

const config: Config = {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Единый цвет линии: рамки карточек, разделители. Был #E4EBF7 (=navy-100) —
        // почти сливался с фоном страницы bg-blue-50 (#F5F8FF). Один шаг темнее
        // по той же шкале (navy-200) — видимая рамка без потери лёгкости бренда.
        line: '#C4D3E0',
        destructive: '#C0392B',
        // CTA кнопки: чёрный фон, белый текст. На #232323 + white = 15.2:1 контраст.
        ink: { DEFAULT: '#232323', hover: '#000000' },
        // Действие. Насыщенный синий макета #4C82F7 даёт с белым текстом
        // только 3.59:1 — под текстом идёт затемнённый DEFAULT (4.63:1),
        // а исходный оттенок остаётся на иконках и рамках, где текста нет.
        primary: {
          DEFAULT: '#3A6FE0',
          hover: '#2E5DC8',
          soft: '#4C82F7',
          tint: '#F2F6FE',
          fg: '#FFFFFF',
          // Нижняя точка градиента кнопок: владелец попросил втрое более
          // глубокий перепад, чем DEFAULT→hover.
          deep: '#1E458F',
        },
        blue: {
          // Решение владельца: фон страницы — нейтральный #F1F1F1 вместо
          // голубоватого #F5F8FF. Токен остаётся blue-50, чтобы не трогать
          // сотню упоминаний в разметке.
          50: '#F1F1F1',
          100: '#D6EAFE',
          200: '#A4D4FC',
          300: '#6BB8F5',
          400: '#3A9AE8',
          500: '#1A3A5C',
        },
        amber: {
          50: '#FFF8E8',
          100: '#FFEDC4',
          200: '#FFD9A0',
          300: '#FFD580',
          400: '#FFB347',
          500: '#E8921A',
          600: '#A66200',
          800: '#7A4700',
        },
        /* Зелёный успеха. Дефолтные тайлвиндовские green-* — мятные, рядом с
           тёплым Nunito и янтарным акцентом выпадают из палитры; плюс
           green-600 на белом даёт 3.34:1 и не проходит AA. Пара tint+DEFAULT
           даёт 4.63:1, DEFAULT на белом — 5.29:1. */
        success: {
          DEFAULT: '#1E7B4D',
          tint: '#E4F4EB',
        },
        navy: {
          // Решение владельца: основной текст на светлом фоне — чистый чёрный.
          900: '#000000',
          800: '#1F2E48',
          700: '#2A3A56',
          600: '#3A4B66',
          500: '#4A5C7A',
          400: '#6B85A0',
          300: '#8FA8C0',
          200: '#C4D3E0',
          100: '#E4EBF7',
        },
      },
      borderRadius: {
        card: '14px',
        banner: '24px',
        pill: '30px', // CTA/outline кнопки — 30px по решению владельца (MASTER «Радиусы — исключения»)
      },
      boxShadow: {
        card: '0 2px 8px rgba(22, 35, 60, 0.06)',
      },
      fontFamily: {
        sans: ['Montserrat', 'system-ui', 'sans-serif'],
        display: ['Montserrat', 'system-ui', 'sans-serif'],
      },
      // Решение владельца: заголовки — semibold. font-bold по всему сайту
      // отображается как 600; extrabold/black чуть тяжелее, но без 800-900 —
      // у Montserrat они выглядят плакатно и ломают лёгкость.
      fontWeight: {
        bold: '600',
        extrabold: '600',
        black: '700',
      },
      transitionTimingFunction: {
        smooth: 'var(--ease-out)',
        drawer: 'var(--ease-drawer)',
      },
      animation: {
        'fade-in': 'fadeIn 0.2s ease-out',
        'slide-down': 'slideDown 0.3s ease-out',
        'slide-up': 'slideUp 0.3s ease-out',
        'badge-pop': 'badgePop 220ms var(--ease-out)',
        'card-in': 'cardIn 240ms var(--ease-out) both',
      },
      keyframes: {
        fadeIn: { from: { opacity: '0' }, to: { opacity: '1' } },
        slideDown: {
          from: { opacity: '0', transform: 'translateY(-10px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        slideUp: {
          from: { opacity: '0', transform: 'translateY(10px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        badgePop: {
          '0%': { transform: 'scale(0.85)' },
          '55%': { transform: 'scale(1.15)' },
          '100%': { transform: 'scale(1)' },
        },
        cardIn: {
          from: { opacity: '0', transform: 'translateY(8px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
      },
    },
  },
  plugins: [],
}

export default config
