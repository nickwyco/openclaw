import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/app/**/*.{ts,tsx}",
    "./src/components/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          50: "#eef6ff",
          100: "#d9eaff",
          200: "#bcd9ff",
          300: "#8ec1ff",
          400: "#599dff",
          500: "#3377ff",
          600: "#1d57f5",
          700: "#1643e1",
          800: "#1838b6",
          900: "#1a358f",
        },
      },
    },
  },
  plugins: [],
};

export default config;
