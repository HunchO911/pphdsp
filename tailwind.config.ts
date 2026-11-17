import type { Config } from "tailwindcss";
const config: Config = {
  darkMode: "class",
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: { extend: { colors: { brand: { 50: "#ecfdf5", 500: "#0f9d78", 600: "#0b8265", 700: "#086650" } } } },
  plugins: [],
};
export default config;
