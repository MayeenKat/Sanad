import { Ionicons } from "@expo/vector-icons";
import * as Linking from "expo-linking";
import { router } from "expo-router";
import { useCallback } from "react";
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useScan } from "@/lib/scan-context";
import { colors, radii, spacing, typography } from "@/lib/theme";

const TAMM_URL = "https://www.tamm.abudhabi";
const TAMM_POLICE_URL = "https://www.tamm.abudhabi/en/life-events/individual/police-services";
const AMAN_PHONE = "8002626";
const EMERGENCY_PHONE = "999";

const STEPS: { icon: keyof typeof Ionicons.glyphMap; title: string; body: string }[] = [
  {
    icon: "hand-left-outline",
    title: "Stop the transaction",
    body: "Do not hand over the item, pay, or share more personal details. Keep this document, the chat history and the other party's phone number as evidence.",
  },
  {
    icon: "phone-portrait-outline",
    title: "Open TAMM",
    body: "Open the TAMM app or tamm.abudhabi and sign in with your UAE PASS.",
  },
  {
    icon: "search-outline",
    title: "Find the fraud report service",
    body: "Go to Police Services and open the Abu Dhabi Police service for reporting a crime or financial fraud. You can also report through the Aman service: call 800 2626, SMS 2828, or email aman@adpolice.gov.ae.",
  },
  {
    icon: "document-attach-outline",
    title: "Attach the evidence",
    body: "Describe what happened, add the vendor or buyer's details, and attach this document together with any payment or chat screenshots.",
  },
  {
    icon: "receipt-outline",
    title: "Save the reference number",
    body: "Submit the report and keep the reference number. The police will contact you to follow up.",
  },
];

export default function ReportScreen() {
  const insets = useSafeAreaInsets();
  const { reset } = useScan();

  const open = useCallback(async (url: string, fallbackMessage: string) => {
    try {
      const supported = await Linking.canOpenURL(url);
      if (!supported) throw new Error("unsupported");
      await Linking.openURL(url);
    } catch {
      Alert.alert("Couldn't open", fallbackMessage);
    }
  }, []);

  const finish = useCallback(() => {
    reset();
    if (router.canDismiss()) router.dismissAll();
    else router.replace("/");
  }, [reset]);

  return (
    <View style={styles.root}>
      <ScrollView
        contentContainerStyle={[styles.content, { paddingTop: insets.top + spacing.sm }]}
        showsVerticalScrollIndicator={false}
      >
        <Pressable onPress={() => router.back()} style={styles.back} hitSlop={12} accessibilityLabel="Back">
          <Ionicons name="chevron-back" size={22} color={colors.text} />
          <Text style={styles.backText}>Back to result</Text>
        </Pressable>

        <View style={styles.hero}>
          <View style={styles.heroIcon}>
            <Ionicons name="megaphone-outline" size={36} color={colors.danger} />
          </View>
          <Text style={styles.title}>Report it to the government</Text>
          <Text style={styles.body}>
            Please report this document to the government using <Text style={styles.strong}>TAMM</Text>, the Abu
            Dhabi Government services platform. Reporting protects you and stops the scammer from targeting others.
          </Text>
        </View>

        <View style={styles.steps}>
          {STEPS.map((step, index) => (
            <View key={step.title} style={styles.step}>
              <View style={styles.stepIndex}>
                <Text style={styles.stepIndexText}>{index + 1}</Text>
              </View>
              <View style={styles.stepBody}>
                <View style={styles.stepTitleRow}>
                  <Ionicons name={step.icon} size={18} color={colors.brand} />
                  <Text style={styles.stepTitle}>{step.title}</Text>
                </View>
                <Text style={styles.stepText}>{step.body}</Text>
              </View>
            </View>
          ))}
        </View>

        <View style={styles.actions}>
          <Pressable
            style={({ pressed }) => [styles.primary, pressed && styles.pressed]}
            onPress={() => open(TAMM_POLICE_URL, `Visit ${TAMM_URL} in your browser.`)}
            accessibilityRole="link"
          >
            <Ionicons name="open-outline" size={20} color={colors.background} />
            <Text style={styles.primaryText}>Open TAMM to report</Text>
          </Pressable>
          <Pressable
            style={({ pressed }) => [styles.outline, pressed && styles.pressed]}
            onPress={() => open(`tel:${AMAN_PHONE}`, `Call Abu Dhabi Police Aman on ${AMAN_PHONE}.`)}
            accessibilityRole="link"
          >
            <Ionicons name="call-outline" size={20} color={colors.text} />
            <Text style={styles.outlineText}>Call Aman service · 800 2626</Text>
          </Pressable>
          <Text style={styles.emergency}>
            If you are in immediate danger or the scammer is with you, call{" "}
            <Text
              style={styles.emergencyLink}
              onPress={() => open(`tel:${EMERGENCY_PHONE}`, `Call ${EMERGENCY_PHONE}.`)}
            >
              999
            </Text>
            .
          </Text>
        </View>
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: insets.bottom + spacing.md }]}>
        <Pressable style={({ pressed }) => [styles.done, pressed && styles.pressed]} onPress={finish} accessibilityRole="button">
          <Text style={styles.doneText}>Done</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xl,
    gap: spacing.lg,
  },
  back: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
    alignSelf: "flex-start",
    paddingVertical: spacing.sm,
  },
  backText: {
    ...typography.body,
    color: colors.text,
  },
  hero: {
    gap: spacing.sm,
  },
  heroIcon: {
    width: 72,
    height: 72,
    borderRadius: radii.pill,
    backgroundColor: colors.dangerSoft,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.xs,
  },
  title: {
    ...typography.display,
    fontSize: 28,
    color: colors.text,
  },
  body: {
    ...typography.body,
    color: colors.textMuted,
  },
  strong: {
    color: colors.text,
    fontWeight: "700",
  },
  steps: {
    gap: spacing.md,
  },
  step: {
    flexDirection: "row",
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: radii.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  stepIndex: {
    width: 30,
    height: 30,
    borderRadius: radii.pill,
    backgroundColor: colors.brandSoft,
    alignItems: "center",
    justifyContent: "center",
  },
  stepIndexText: {
    ...typography.heading,
    color: colors.brand,
  },
  stepBody: {
    flex: 1,
    gap: spacing.xs,
  },
  stepTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  stepTitle: {
    ...typography.heading,
    color: colors.text,
  },
  stepText: {
    ...typography.body,
    color: colors.textMuted,
  },
  actions: {
    gap: spacing.sm,
  },
  primary: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
    paddingVertical: 16,
    borderRadius: radii.pill,
    backgroundColor: colors.brand,
  },
  primaryText: {
    ...typography.heading,
    color: colors.background,
  },
  outline: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
    paddingVertical: 16,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  outlineText: {
    ...typography.heading,
    color: colors.text,
  },
  emergency: {
    ...typography.caption,
    color: colors.textMuted,
    textAlign: "center",
    marginTop: spacing.xs,
  },
  emergencyLink: {
    color: colors.danger,
    fontWeight: "700",
  },
  pressed: {
    opacity: 0.85,
  },
  footer: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  done: {
    alignItems: "center",
    paddingVertical: 16,
    borderRadius: radii.pill,
    backgroundColor: colors.surfaceRaised,
    borderWidth: 1,
    borderColor: colors.border,
  },
  doneText: {
    ...typography.heading,
    color: colors.text,
  },
});
