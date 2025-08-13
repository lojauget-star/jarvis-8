/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        'jarvis-bg': '#0a0a0f',
        'jarvis-blue': '#00f2ff',
        'jarvis-dark-blue': '#0c3a5e',
        'jarvis-gray': '#1a2a3a',
      },
      boxShadow: {
        'glow-blue': '0 0 15px 5px rgba(0, 242, 255, 0.4), 0 0 5px 1px rgba(0, 242, 255, 0.6)',
        'glow-blue-light': '0 0 8px 2px rgba(0, 242, 255, 0.3)',
      },
      fontFamily: {
        'sans': ['system-ui', 'sans-serif'],
        'mono': ['monospace'],
      },
      keyframes: {
          pulse: {
              '0%, 100%': { transform: 'scale(1)', opacity: '1' },
              '50%': { transform: 'scale(1.05)', opacity: '0.8' },
          },
          speaking: {
              '0%, 100%': { filter: 'brightness(1)' },
              '50%': { filter: 'brightness(1.25)' },
          },
          fadeIn: {
              'from': { opacity: '0', transform: 'translateY(10px)' },
              'to': { opacity: '1', transform: 'translateY(0)' },
          },
      },
      animation: {
          pulse: 'pulse 4s cubic-bezier(0.4, 0, 0.6, 1) infinite',
          speaking: 'speaking 2s ease-in-out infinite',
          'fade-in': 'fadeIn 0.5s ease-out forwards',
      },
    },
  },
  plugins: [],
}
