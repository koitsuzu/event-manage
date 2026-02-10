/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        'market-cream': '#F9F7F2',    // 類紙粉白
        'market-wood': '#D2B48C',     // 暖木色
        'market-green': '#8FBC8F',    // 莫蘭迪綠
        'market-charcoal': '#4A4A4A', // 深炭灰 (文字用)
        'market-clay': '#B87333',     // 陶土色
      },
      fontFamily: {
        serif: ['"Noto Serif TC"', 'serif'],
        sans: ['"Noto Sans TC"', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
