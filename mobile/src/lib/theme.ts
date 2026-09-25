export const colors = {
  background: "#0B0F14",
  surface: "#141A22",
  surfaceRaised: "#1C242E",
  border: "#273140",
  text: "#F2F5F8",
  textMuted: "#9AA6B5",
  brand: "#D4A24C",
  brandSoft: "rgba(212, 162, 76, 0.16)",
  danger: "#E5484D",
  dangerDark: "#7F1D1D",
  dangerSoft: "rgba(229, 72, 77, 0.16)",
  safe: "#2FBF71",
  safeDark: "#14532D",
  safeSoft: "rgba(47, 191, 113, 0.16)",
  warning: "#F5A524",
  overlay: "rgba(0, 0, 0, 0.55)",
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
