import type { Config } from 'tailwindcss'

export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      boxShadow: {
        glass: '0 10px 25px rgba(0,0,0,0.08)',
      },
      backdropBlur: {
        xs: '2px',
        sm: '4px',
        md: '10px',
        lg: '14px',
      },
    },
  },
  plugins: [],
} satisfies Config
