/** @type {import('tailwindcss').Config} */

// "Vivid Architectural Minimal" design system — see
// stitch_tripwire_ui_revamp/.../vivid_architectural_minimal/DESIGN.md.
// The dashboard is styled with hardcoded `indigo-*`/`slate-*` utilities, so the
// cleanest way to reskin the whole surface is to remap those scales here:
// `indigo` becomes the brand red-violet ramp (anchored at 600 = #c53678), and
// the neutral `slate` family is nudged toward the warm-grey architectural tones.
const brand = {
  50: "#fdf2f7",
  100: "#fce4ef",
  200: "#f9c9df",
  300: "#f39fc4",
  400: "#e96aa1",
  500: "#d84683",
  600: "#c53678", // primary-container
  700: "#a4185f", // primary
  800: "#87124e",
  900: "#6f1342",
  950: "#450a26",
};

export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ['"Hanken Grotesk"', 'Inter', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
        display: ['Outfit', '"Hanken Grotesk"', 'Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'ui-monospace', 'SFMono-Regular', 'Menlo', 'Monaco', 'monospace'],
      },
      colors: {
        brand,
        indigo: brand,
      },
      borderRadius: {
        // Soft-Precision: sharper than the default consumer pill look.
        lg: "0.375rem",
        xl: "0.625rem",
        "2xl": "0.875rem",
      },
    },
  },
  plugins: [],
};
