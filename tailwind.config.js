/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        // Disney-inspired color palette
        disney: {
          blue: '#0063B2',
          darkblue: '#003D82',
          gold: '#FFB900',
          red: '#E4002B',
          purple: '#6B2775',
        },
        deal: {
          excellent: '#EF4444', // Red - 30%+ off
          great: '#F59E0B', // Orange - 20-29% off
          good: '#EAB308', // Yellow - 10-19% off
          standard: '#10B981', // Green - <10% off
          perk: '#8B5CF6', // Purple - Free dining/perks
          upgrade: '#3B82F6', // Blue - Room upgrades
        },
      },
      animation: {
        'fade-in': 'fadeIn 0.3s ease-in-out',
        'slide-up': 'slideUp 0.3s ease-out',
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { transform: 'translateY(10px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
      },
    },
  },
  plugins: [
    require('@tailwindcss/forms'),
  ],
}
