import type { Config } from "tailwindcss";

const config = {
  darkMode: ["class"],
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}",
  ],
  theme: {
    container: {
      center: true,
      padding: "2rem",
      screens: {
        "2xl": "1440px",
      },
    },
    extend: {
      fontFamily: {
        sans: ["var(--font-inter)", "Inter", "-apple-system", "BlinkMacSystemFont", '"Segoe UI"', "Roboto", "sans-serif"],
        mono: ["var(--font-geist-mono)", '"JetBrains Mono"', "ui-monospace", "monospace"],
        display: ["var(--font-inter)", "Inter", "sans-serif"],
      },
      colors: {
        // BMW M Design System
        border: "var(--color-border)",
        input: "var(--color-input)",
        ring: "var(--color-ring)",
        background: "var(--color-background)",
        foreground: "var(--color-foreground)",
        primary: {
          DEFAULT: "var(--color-primary)",
          foreground: "var(--color-primary-foreground)",
        },
        secondary: {
          DEFAULT: "var(--color-secondary)",
          foreground: "var(--color-secondary-foreground)",
        },
        destructive: {
          DEFAULT: "var(--color-destructive)",
          foreground: "var(--color-destructive-foreground)",
        },
        muted: {
          DEFAULT: "var(--color-muted)",
          foreground: "var(--color-muted-foreground)",
        },
        accent: {
          DEFAULT: "var(--color-accent)",
          foreground: "var(--color-accent-foreground)",
        },
        popover: {
          DEFAULT: "var(--color-popover)",
          foreground: "var(--color-popover-foreground)",
        },
        card: {
          DEFAULT: "var(--color-card)",
          foreground: "var(--color-card-foreground)",
        },
        // BMW M brand accents
        bmw: {
          "blue-light": "#0066b1",
          "blue-dark": "#1c69d4",
          red: "#e22718",
          "electric-blue": "#0653b6",
        },
        // Surface tones
        surface: {
          card: "#1a1a1a",
          elevated: "#262626",
          soft: "#0d0d0d",
          "carbon-gray": "#2b2b2b",
        },
        // Hairlines
        hairline: "#3c3c3c",
        "hairline-strong": "#262626",
      },
      borderRadius: {
        none: "0px",
        xs: "2px",
        sm: "4px",
        md: "6px",
        full: "9999px",
      },
      // No shadows — BMW M uses flat surfaces, no drop shadows
      boxShadow: {
        none: "none",
        hairline: "inset 0 0 0 1px #3c3c3c",
      },
      fontSize: {
        // BMW typography scale
        "display-xl": ["80px", { lineHeight: "1", fontWeight: "700", letterSpacing: "0" }],
        "display-lg": ["56px", { lineHeight: "1.05", fontWeight: "700", letterSpacing: "0" }],
        "display-md": ["40px", { lineHeight: "1.1", fontWeight: "700", letterSpacing: "0" }],
        "display-sm": ["32px", { lineHeight: "1.15", fontWeight: "700", letterSpacing: "0" }],
        "title-lg": ["24px", { lineHeight: "1.3", fontWeight: "700", letterSpacing: "0" }],
        "title-md": ["20px", { lineHeight: "1.4", fontWeight: "400", letterSpacing: "0" }],
        "title-sm": ["18px", { lineHeight: "1.4", fontWeight: "400", letterSpacing: "0" }],
        "label-uppercase": ["14px", { lineHeight: "1.3", fontWeight: "700", letterSpacing: "1.5px" }],
        "body-md": ["16px", { lineHeight: "1.5", fontWeight: "300", letterSpacing: "0" }],
        "body-sm": ["14px", { lineHeight: "1.5", fontWeight: "300", letterSpacing: "0" }],
        caption: ["12px", { lineHeight: "1.4", fontWeight: "400", letterSpacing: "0.5px" }],
      },
      spacing: {
        xxs: "4px",
        xs: "8px",
        sm: "12px",
        md: "16px",
        lg: "24px",
        xl: "40px",
        xxl: "64px",
        section: "96px",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
} satisfies Config;

export default config;
