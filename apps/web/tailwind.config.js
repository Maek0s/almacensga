/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#13213a",
        navy: "#071a35",
        brand: "#1769ff",
        teal: "#12b8b0",
      },
      boxShadow: {
        panel: "0 12px 32px rgba(19, 33, 58, 0.08)",
      },
    },
  },
  plugins: [],
};
