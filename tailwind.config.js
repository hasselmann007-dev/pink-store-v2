/** @type {import('tailwindcss').Config} */
export default {
  content: [
    // O Tailwind vai procurar classes em todos os ficheiros .html, .js, .ts, .jsx, e .tsx
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {},
  },
  plugins: [],
}