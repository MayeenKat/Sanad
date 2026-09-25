export const colors = {
  background: "#FFFFFF",
  surface: "#F4F6F9",
  surfaceRaised: "#FFFFFF",
  border: "#DDE3EB",
  text: "#0F2A47",
  textMuted: "#5F6B7A",
  navy: "#0A2E52",
  navyDark: "#06213D",
  navySoft: "rgba(10, 46, 82, 0.08)",
  brand: "#C8985A",
  brandDark: "#A87B3F",
  brandSoft: "rgba(200, 152, 90, 0.16)",
  danger: "#D6363C",
  dangerDark: "#8F1D22",
  dangerSoft: "rgba(214, 54, 60, 0.12)",
  safe: "#1F9D5A",
  safeDark: "#14663B",
  safeSoft: "rgba(31, 157, 90, 0.12)",
  warning: "#E09B1A",
  overlay: "rgba(6, 33, 61, 0.55)",
  white: "#FFFFFF",
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
} as const;

export const radii = {
  sm: 8,
  md: 14,
  lg: 22,
  pill: 999,
} as const;

export const typography = {
  display: { fontSize: 30, fontWeight: "800" as const, letterSpacing: -0.5 },
  title: { fontSize: 22, fontWeight: "700" as const },
  heading: { fontSize: 17, fontWeight: "700" as const },
  body: { fontSize: 15, lineHeight: 22 },
  caption: { fontSize: 13, lineHeight: 18 },
  label: { fontSize: 12, fontWeight: "700" as const, letterSpacing: 1.2, textTransform: "uppercase" as const },
} as const;

export const shadow = {
  card: {
    shadowColor: "#0A2E52",
    shadowOpacity: 0.08,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
} as const;
