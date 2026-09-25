import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Animated, Easing, Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { analyzeDocuments } from "@/lib/api";
import { useScan } from "@/lib/scan-context";
import { colors, radii, spacing, typography } from "@/lib/theme";

const STEPS = [
  "Reading document metadata",
  "Checking issuer and software fingerprints",
  "Inspecting content for edits",
  "Validating IDs, IBANs and dates",
];

export default function AnalyzingScreen() {
  const insets = useSafeAreaInsets();
  const { documents, setResult } = useScan();
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [step, setStep] = useState(0);
  const [pulse] = useState(() => new Animated.Value(0));

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 900, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0, duration: 900, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [pulse]);

  useEffect(() => {
    if (error) return;
    const timer = setInterval(() => setStep((s) => Math.min(s + 1, STEPS.length - 1)), 700);
    return () => clearInterval(timer);
  }, [attempt, error]);

  useEffect(() => {
    if (documents.length === 0) {
      router.replace("/");
      return;
    }
    const controller = new AbortController();
    const started = Date.now();

    analyzeDocuments(documents, controller.signal)
      .then(async (result) => {
        const elapsed = Date.now() - started;
        if (elapsed < 1800) await new Promise((r) => setTimeout(r, 1800 - elapsed));
        if (controller.signal.aborted) return;
        setResult(result);
        router.replace("/result");
      })
      .catch((err: unknown) => {
        if (controller.signal.aborted) return;
        setError(err instanceof Error ? err.message : "Something went wrong while verifying the document.");
      });

    return () => controller.abort();
  }, [attempt, documents, setResult]);

  const retry = useCallback(() => {
    setError(null);
    setStep(0);
    setAttempt((a) => a + 1);
  }, []);
  const goBack = useCallback(() => router.replace("/"), []);

  const scale = pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.12] });
  const opacity = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.35, 0.05] });

  return (
    <View style={[styles.root, { paddingTop: insets.top + spacing.xl, paddingBottom: insets.bottom + spacing.lg }]}>
      {error ? (
        <View style={styles.center}>
          <View style={[styles.iconWrap, styles.iconWrapError]}>
            <Ionicons name="cloud-offline-outline" size={44} color={colors.warning} />
          </View>
          <Text style={styles.title}>Verification unavailable</Text>
          <Text style={styles.body}>{error}</Text>
          <View style={styles.actions}>
            <Pressable style={styles.primary} onPress={retry} accessibilityRole="button">
              <Ionicons name="refresh" size={18} color={colors.white} />
              <Text style={styles.primaryText}>Try again</Text>
            </Pressable>
            <Pressable style={styles.secondary} onPress={goBack} accessibilityRole="button">
              <Text style={styles.secondaryText}>Back to camera</Text>
            </Pressable>
          </View>
        </View>
      ) : (
        <View style={styles.center}>
          <View style={styles.pulseWrap}>
            <Animated.View style={[styles.pulseRing, { opacity, transform: [{ scale }] }]} />
            <View style={styles.iconWrap}>
              <Ionicons name="shield-half" size={44} color={colors.navy} />
            </View>
          </View>
          <Text style={styles.title}>Verifying {documents.length > 1 ? `${documents.length} pages` : "document"}</Text>
          <Text style={styles.body}>This takes a few seconds.</Text>
          <View style={styles.steps}>
            {STEPS.map((label, index) => {
              const done = index < step;
              const active = index === step;
              return (
                <View key={label} style={styles.stepRow}>
                  {done ? (
                    <Ionicons name="checkmark-circle" size={20} color={colors.safe} />
                  ) : active ? (
                    <ActivityIndicator size="small" color={colors.brand} />
                  ) : (
                    <Ionicons name="ellipse-outline" size={20} color={colors.border} />
                  )}
                  <Text style={[styles.stepText, (done || active) && styles.stepTextActive]}>{label}</Text>
                </View>
              );
            })}
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.background,
    paddingHorizontal: spacing.xl,
  },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.md,
  },
  pulseWrap: {
    width: 160,
    height: 160,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.md,
  },
  pulseRing: {
    position: "absolute",
    width: 160,
    height: 160,
    borderRadius: radii.pill,
    backgroundColor: colors.brand,
  },
  iconWrap: {
    width: 104,
    height: 104,
    borderRadius: radii.pill,
    backgroundColor: colors.brandSoft,
    alignItems: "center",
    justifyContent: "center",
  },
  iconWrapError: {
    backgroundColor: "rgba(224, 155, 26, 0.14)",
    marginBottom: spacing.md,
  },
  title: {
    ...typography.title,
    color: colors.text,
    textAlign: "center",
  },
  body: {
    ...typography.body,
    color: colors.textMuted,
    textAlign: "center",
  },
  steps: {
    alignSelf: "stretch",
    marginTop: spacing.lg,
    gap: spacing.md,
    padding: spacing.lg,
    borderRadius: radii.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  stepRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
  },
  stepText: {
    ...typography.body,
    color: colors.textMuted,
  },
  stepTextActive: {
    color: colors.text,
  },
  actions: {
    alignSelf: "stretch",
    gap: spacing.sm,
    marginTop: spacing.lg,
  },
  primary: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
    paddingVertical: 16,
    borderRadius: radii.pill,
    backgroundColor: colors.navy,
  },
  primaryText: {
    ...typography.heading,
    color: colors.white,
  },
  secondary: {
    alignItems: "center",
    paddingVertical: 14,
  },
  secondaryText: {
    ...typography.heading,
    color: colors.textMuted,
  },
});
