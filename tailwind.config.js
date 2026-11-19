/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: [
          '"Plus Jakarta Sans"',
          'ui-sans-serif',
          'system-ui',
          '-apple-system',
          'sans-serif',
        ],
        mono: [
          '"JetBrains Mono"',
          'ui-monospace',
          'SFMono-Regular',
          'monospace',
        ],
      },
      colors: {
        canvas: '#FAF8F5',
        surface: '#FFFFFF',
        subtle: '#F3EFE8',
        border: '#E6E1D8',
        ink: {
          DEFAULT: '#1C1917',
          muted: '#57534E',
          faint: '#8A837A',
        },
        forest: {
          50: '#EDF5F0',
          100: '#D5E8DC',
          200: '#AED1BC',
          600: '#245842',
          700: '#1B4332',
          800: '#143326',
          900: '#0D2219',
        },
        terracotta: {
          50: '#FDF3EC',
          100: '#FADFD0',
          500: '#D26B34',
          600: '#C25E28',
          700: '#9E491C',
        },
        brand: {
          50: '#EDF5F0',
          100: '#D5E8DC',
          500: '#2D6A4F',
          600: '#1B4332',
          700: '#143326',
        },
      },
    },
  },
  plugins: [],
};
