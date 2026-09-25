import { Ionicons } from "@expo/vector-icons";
import { StyleSheet, Text, View } from "react-native";

import { colors, radii, spacing, typography } from "@/lib/theme";
import type { Finding, Severity } from "@/lib/types";

const SEVERITY_LABEL: Record<Severity, string> = {
  critical: "Critical",
  high: "High risk",
  medium: "Suspicious",
  low: "Minor",
  info: "Note",
};

const SEVERITY_COLOR: Record<Severity, string> = {
  critical: colors.danger,
  high: colors.danger,
  medium: colors.warning,
  low: colors.textMuted,
  info: colors.textMuted,
};

const SEVERITY_ICON: Record<Severity, keyof typeof Ionicons.glyphMap> = {
  critical: "alert-circle",
  high: "warning",
  medium: "help-circle",
  low: "information-circle",
  info: "information-circle-outline",
};

export function FindingCard({ finding, index }: { finding: Finding; index: number }) {
  const tone = SEVERITY_COLOR[finding.severity];
  return (
    <View style={styles.card} accessibilityRole="summary">
      <View style={styles.header}>
        <View style={[styles.indexBadge, { borderColor: tone }]}>
          <Text style={[styles.indexText, { color: tone }]}>{index + 1}</Text>
        </View>
        <Text style={styles.title}>{finding.title}</Text>
      </View>
      <Text style={styles.detail}>{finding.detail}</Text>
      <View style={[styles.severity, { backgroundColor: `${tone}22` }]}>
        <Ionicons name={SEVERITY_ICON[finding.severity]} size={14} color={tone} />
        <Text style={[styles.severityText, { color: tone }]}>{SEVERITY_LABEL[finding.severity]}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: radii.md,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.border,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  indexBadge: {
    width: 26,
    height: 26,
    borderRadius: radii.pill,
    borderWidth: 1.5,
    alignItems: "center",
    justifyContent: "center",
  },
  indexText: {
    ...typography.caption,
    fontWeight: "700",
  },
  title: {
    ...typography.heading,
    color: colors.text,
    flex: 1,
  },
  detail: {
    ...typography.body,
    color: colors.textMuted,
  },
  severity: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: radii.pill,
  },
  severityText: {
    ...typography.caption,
    fontWeight: "700",
  },
});
