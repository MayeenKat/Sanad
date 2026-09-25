import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { FindingCard } from "@/components/FindingCard";
import { useScan } from "@/lib/scan-context";
import { colors, radii, spacing, typography } from "@/lib/theme";
import type { DocumentReport } from "@/lib/types";

const METADATA_LABELS: Record<string, string> = {
  format: "Format",
  dimensions: "Dimensions",
  software: "Software",
  camera: "Camera",
  captured: "Captured",
  modified: "Last modified",
  created: "Created",
  producer: "Producer",
  creator: "Creator",
  author: "Author",
  title: "Title",
  pages: "Pages",
  revisions: "Revisions",
  digitally_signed: "Digitally signed",
};

const AUTHENTIC_CHECKS = [
  "No photo or PDF editing software fingerprints",
  "Creation and modification timestamps are consistent",
  "No overlays, redactions or hidden revisions",
  "IDs, account numbers and dates validate",
];

export default function ResultScreen() {
  const insets = useSafeAreaInsets();
  const { result, reset } = useScan();

  useEffect(() => {
    if (!result) {
      router.replace("/");
      return;
    }
    Haptics.notificationAsync(
      result.verdict === "fraud"
        ? Haptics.NotificationFeedbackType.Error
        : Haptics.NotificationFeedbackType.Success,
    ).catch(() => undefined);
  }, [result]);

  const done = useCallback(() => {
    reset();
    if (router.canDismiss()) router.dismissAll();
    else router.replace("/");
  }, [reset]);

  if (!result) return null;
  const fraud = result.verdict === "fraud";
  const tone = fraud ? colors.danger : colors.safe;

  return (
    <View style={[styles.root, fraud ? styles.rootFraud : styles.rootSafe]}>
      <ScrollView
        contentContainerStyle={[styles.content, { paddingTop: insets.top + spacing.lg }]}
        showsVerticalScrollIndicator={false}
      >
        <View style={[styles.hero, { backgroundColor: fraud ? colors.dangerDark : colors.safeDark }]}>
          <View style={[styles.heroIcon, { backgroundColor: tone }]}>
            <Ionicons name={fraud ? "alert" : "checkmark"} size={54} color={colors.white} />
          </View>
          <Text style={[styles.label, { color: fraud ? "#FCA5A5" : "#86EFAC" }]}>
            {fraud ? "Danger" : "Safe"}
          </Text>
          <Text style={styles.heroTitle}>
            {fraud ? "Alert: This is a fraud document!" : "This is a real document, you can proceed"}
          </Text>
          <Text style={styles.heroSummary}>{result.summary}</Text>
          <View style={styles.scoreRow}>
            <Text style={styles.scoreLabel}>Risk score</Text>
            <View style={styles.scoreTrack}>
              <View style={[styles.scoreFill, { width: `${Math.max(4, result.risk_score)}%`, backgroundColor: tone }]} />
            </View>
            <Text style={styles.scoreValue}>{result.risk_score}/100</Text>
          </View>
        </View>

        {fraud ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Why this document is fake</Text>
            <Text style={styles.sectionBody}>
              We found {result.findings.length} {result.findings.length === 1 ? "problem" : "problems"} in the
              document&apos;s content and metadata.
            </Text>
            <View style={styles.list}>
              {result.findings.map((finding, index) => (
                <FindingCard key={`${finding.code}-${index}`} finding={finding} index={index} />
              ))}
            </View>
          </View>
        ) : (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>What we checked</Text>
            <View style={styles.checks}>
              {AUTHENTIC_CHECKS.map((check) => (
                <View key={check} style={styles.checkRow}>
                  <Ionicons name="checkmark-circle" size={20} color={colors.safe} />
                  <Text style={styles.checkText}>{check}</Text>
                </View>
              ))}
            </View>
            {result.findings.length > 0 && (
              <View style={styles.list}>
                <Text style={styles.sectionBody}>Minor observations that don&apos;t indicate fraud:</Text>
                {result.findings.map((finding, index) => (
                  <FindingCard key={`${finding.code}-${index}`} finding={finding} index={index} />
                ))}
              </View>
            )}
          </View>
        )}

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Document details</Text>
          {result.documents.map((doc) => (
            <DocumentDetails key={doc.filename} document={doc} />
          ))}
        </View>
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: insets.bottom + spacing.md }]}>
        {fraud ? (
          <Pressable
            style={({ pressed }) => [styles.cta, { backgroundColor: colors.danger }, pressed && styles.pressed]}
            onPress={() => router.push("/report")}
            accessibilityRole="button"
          >
            <Text style={styles.ctaText}>How to proceed</Text>
            <Ionicons name="arrow-forward" size={20} color={colors.white} />
          </Pressable>
        ) : (
          <Pressable
            style={({ pressed }) => [styles.cta, { backgroundColor: colors.safe }, pressed && styles.pressed]}
            onPress={done}
            accessibilityRole="button"
          >
            <Ionicons name="checkmark-circle" size={20} color={colors.white} />
            <Text style={styles.ctaText}>Done</Text>
          </Pressable>
        )}
        <Pressable style={styles.secondary} onPress={done} accessibilityRole="button">
          <Text style={styles.secondaryText}>Scan another document</Text>
        </Pressable>
      </View>
    </View>
  );
}

function DocumentDetails({ document }: { document: DocumentReport }) {
  const [open, setOpen] = useState(false);
  const entries = Object.entries(document.metadata);
  const sizeKb = Math.max(1, Math.round(document.size_bytes / 1024));
  return (
    <View style={styles.doc}>
      <Pressable style={styles.docHeader} onPress={() => setOpen((o) => !o)} accessibilityRole="button">
        <Ionicons
          name={document.kind === "pdf" ? "document-text-outline" : "image-outline"}
          size={20}
          color={colors.brand}
        />
        <View style={styles.docTitleWrap}>
          <Text style={styles.docTitle} numberOfLines={1}>
            {document.filename}
          </Text>
          <Text style={styles.docMeta}>
            {document.kind.toUpperCase()} · {sizeKb} KB · {document.findings.length}{" "}
            {document.findings.length === 1 ? "finding" : "findings"}
          </Text>
        </View>
        <Ionicons name={open ? "chevron-up" : "chevron-down"} size={18} color={colors.textMuted} />
      </Pressable>
      {open && (
        <View style={styles.docBody}>
          {entries.length === 0 ? (
            <Text style={styles.docMeta}>No metadata embedded in this file.</Text>
          ) : (
            entries.map(([key, value]) => (
              <View key={key} style={styles.metaRow}>
                <Text style={styles.metaKey}>{METADATA_LABELS[key] ?? key}</Text>
                <Text style={styles.metaValue}>{value}</Text>
              </View>
            ))
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  rootFraud: {
    backgroundColor: "#160B0C",
  },
  rootSafe: {
    backgroundColor: "#0A1510",
  },
  content: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xl,
    gap: spacing.lg,
  },
  hero: {
    alignItems: "center",
    gap: spacing.sm,
    padding: spacing.lg,
    paddingTop: spacing.xl,
    borderRadius: radii.lg,
  },
  heroIcon: {
    width: 96,
    height: 96,
    borderRadius: radii.pill,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.sm,
  },
  label: {
    ...typography.label,
  },
  heroTitle: {
    ...typography.display,
    fontSize: 26,
    color: colors.white,
    textAlign: "center",
  },
  heroSummary: {
    ...typography.body,
    color: "rgba(255,255,255,0.8)",
    textAlign: "center",
  },
  scoreRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    alignSelf: "stretch",
    marginTop: spacing.md,
  },
  scoreLabel: {
    ...typography.caption,
    color: "rgba(255,255,255,0.7)",
  },
  scoreTrack: {
    flex: 1,
    height: 8,
    borderRadius: radii.pill,
    backgroundColor: "rgba(0,0,0,0.35)",
    overflow: "hidden",
  },
  scoreFill: {
    height: "100%",
    borderRadius: radii.pill,
  },
  scoreValue: {
    ...typography.caption,
    fontWeight: "700",
    color: colors.white,
  },
  section: {
    gap: spacing.sm,
  },
  sectionTitle: {
    ...typography.title,
    color: colors.text,
  },
  sectionBody: {
    ...typography.body,
    color: colors.textMuted,
  },
  list: {
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  checks: {
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: radii.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  checkRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  checkText: {
    ...typography.body,
    color: colors.text,
    flex: 1,
  },
  doc: {
    borderRadius: radii.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: "hidden",
  },
  docHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    padding: spacing.md,
  },
  docTitleWrap: {
    flex: 1,
    gap: 2,
  },
  docTitle: {
    ...typography.heading,
    color: colors.text,
  },
  docMeta: {
    ...typography.caption,
    color: colors.textMuted,
  },
  docBody: {
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: spacing.sm,
  },
  metaRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: spacing.md,
  },
  metaKey: {
    ...typography.caption,
    color: colors.textMuted,
  },
  metaValue: {
    ...typography.caption,
    color: colors.text,
    flex: 1,
    textAlign: "right",
  },
  footer: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    gap: spacing.xs,
    borderTopWidth: 1,
    borderTopColor: "rgba(255,255,255,0.06)",
  },
  cta: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
    paddingVertical: 18,
    borderRadius: radii.pill,
  },
  ctaText: {
    ...typography.heading,
    fontSize: 18,
    color: colors.white,
  },
  pressed: {
    opacity: 0.85,
  },
  secondary: {
    alignItems: "center",
    paddingVertical: spacing.sm,
  },
  secondaryText: {
    ...typography.caption,
    color: colors.textMuted,
  },
});
