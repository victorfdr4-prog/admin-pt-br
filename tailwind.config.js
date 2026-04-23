import defaultTheme from "tailwindcss/defaultTheme";

/** @type {import('tailwindcss').Config} */
export default {
  darkMode: ["class"],
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ["Inter", ...defaultTheme.fontFamily.sans],
        display: ["Inter", ...defaultTheme.fontFamily.sans],
        mono: ["JetBrains Mono", ...defaultTheme.fontFamily.mono],
      },
      borderRadius: {
        lg: "var(--radius-lg)",
        md: "var(--radius-md)",
        sm: "var(--radius-sm)",
      },
      colors: {
        background: "var(--background)",
        foreground: "var(--foreground)",
        card: "var(--card)",
        "card-foreground": "var(--card-foreground)",
        popover: "var(--popover)",
        "popover-foreground": "var(--popover-foreground)",
        border: "var(--border)",
        input: "var(--input)",
        ring: "var(--ring)",
        primary: {
          DEFAULT: "var(--primary)",
          foreground: "var(--primary-foreground)",
        },
        secondary: {
          DEFAULT: "var(--secondary)",
          foreground: "var(--secondary-foreground)",
        },
        muted: {
          DEFAULT: "var(--muted)",
          foreground: "var(--muted-foreground)",
        },
        accent: {
          DEFAULT: "var(--accent)",
          foreground: "var(--accent-foreground)",
        },
        destructive: {
          DEFAULT: "var(--destructive)",
          foreground: "var(--destructive-foreground)",
        },
        surface: {
          app: "var(--surface-app)",
          sidebar: "var(--surface-sidebar)",
          topbar: "var(--surface-topbar)",
          card: "var(--surface-card)",
        },
        semantic: {
          danger: {
            bg: "var(--status-danger-bg)",
            text: "var(--status-danger-fg)",
            border: "var(--status-danger-border)",
          },
          warning: {
            bg: "var(--status-warning-bg)",
            text: "var(--status-warning-fg)",
            border: "var(--status-warning-border)",
          },
          success: {
            bg: "var(--status-success-bg)",
            text: "var(--status-success-fg)",
            border: "var(--status-success-border)",
          },
          info: {
            bg: "var(--status-info-bg)",
            text: "var(--status-info-fg)",
            border: "var(--status-info-border)",
          },
        },
      },
      boxShadow: {
        card: "0 12px 30px rgba(16, 24, 40, 0.08)",
        overlay: "0 24px 64px rgba(16, 24, 40, 0.16)",
      },
    },
  },
};
