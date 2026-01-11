export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        petri: {
          dark: '#0a0a0f',
          bg: '#1a1a2e',
          accent: '#16213e',
          highlight: '#0f3460',
          glow: '#e94560',
        }
      }
    },
  },
  plugins: [],
}
