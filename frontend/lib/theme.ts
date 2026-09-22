export const THEME_COLORS = {
  primary: {
    50: "#F0F5FA", 100: "#DCE8F3", 200: "#B9CFE3", 300: "#8EAFCA", 400: "#5F89AB",
    500: "#2F638F", 600: "#1D4F7A", 700: "#153F63", 800: "#12345B", 900: "#0B1F3A",
  },
  accent: { 50: "#ECFEF8", 100: "#CCFBEA", 300: "#5EEAD4", 500: "#0F9F8C", 600: "#087F70", 700: "#06665A" },
  action: { 50: "#FFF7ED", 500: "#EA580C", 600: "#C2410C", 700: "#9A3412" },
  success: { 50: "#ECFDF5", 600: "#059669", 700: "#047857" },
  danger: { 50: "#FEF2F2", 600: "#DC2626", 700: "#B91C1C" },
  warning: { 50: "#FFFBEB", 600: "#D97706", 800: "#92400E" },
  info: { 50: "#EFF6FF", 600: "#2563EB", 800: "#1E40AF" },
  neutral: {
    0: "#FFFFFF", 50: "#F8FAFC", 100: "#F1F5F9", 200: "#E2E8F0", 300: "#CBD5E1",
    400: "#94A3B8", 500: "#64748B", 600: "#475569", 700: "#334155", 800: "#1E293B", 900: "#0F172A",
  },
} as const;

export const THEME_COLOR = THEME_COLORS.primary[800];