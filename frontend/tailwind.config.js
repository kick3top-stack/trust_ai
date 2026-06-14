/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        trust: {
          50: "#f0fdf9",
          500: "#14b8a6",
          600: "#0d9488",
          900: "#134e4a",
        },
      },
    },
  },
  plugins: [],
};
