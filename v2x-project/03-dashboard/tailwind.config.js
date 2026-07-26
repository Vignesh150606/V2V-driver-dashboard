/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        base: '#0B0F14',
        panel: '#121821',
        panel2: '#161D28',
        line: '#223041',
        line2: '#2C3B4E',
        ink: '#E7EDF3',
        ink2: '#8FA3B8',
        ink3: '#5A6B7D',
        amber: '#FFB020',
        teal: '#29C7B3',
        red: '#FF5A5F',
        blue: '#4C8DFF',
      },
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace'],
      },
    },
  },
  plugins: [],
};
