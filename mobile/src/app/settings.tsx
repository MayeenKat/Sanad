import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { DEFAULT_API_URL, getApiUrl, normalizeApiUrl, pingApi, setApiUrl } from "@/lib/server";
import { colors, radii, spacing, typography } from "@/lib/theme";

type Status = { kind: "idle" } | { kind: "testing" } | { kind: "ok"; url: string } | { kind: "fail"; url: string };

export default function SettingsScreen() {
  const insets = useSafeAreaInsets();
  const [value, setValue] = useState("");
  const [loaded, setLoaded] = useState(false);
  const [status, setStatus] = useState<Status>({ kind: "idle" });

  useEffect(() => {
    getApiUrl().then((url) => {
      setValue(url);
      setLoaded(true);
    });
  }, []);

  const normalized = normalizeApiUrl(value);

  const test = useCallback(async () => {
    if (!normalized) return;
    setStatus({ kind: "testing" });
    const ok = await pingApi(normalized);
    setStatus(ok ? { kind: "ok", url: normalized } : { kind: "fail", url: normalized });
  }, [normalized]);

  const save = useCallback(async () => {
    const saved = await setApiUrl(value);
    setValue(saved);
    if (router.canGoBack()) router.back();
    else router.replace("/");
  }, [value]);

  const resetDefault = useCallback(() => {
    setValue(DEFAULT_API_URL);
    setStatus({ kind: "idle" });
  }, []);

  const close = useCallback(() => {
    if (router.canGoBack()) router.back();
    else router.replace("/");
  }, []);

  return (
    <KeyboardAvoidingView style={styles.root} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingTop: insets.top + spacing.md, paddingBottom: insets.bottom + spacing.xl },
        ]}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.header}>
          <Pressable onPress={close} style={styles.iconButton} accessibilityRole="button" accessibilityLabel="Close">
            <Ionicons name="close" size={22} color={colors.text} />
          </Pressable>
          <Text style={styles.title}>Verification server</Text>
        </View>

        <Text style={styles.body}>
          SANAD sends documents to its own verification service for analysis. Enter the address of the computer
          running the backend so this device can reach it.
        </Text>

        <Text style={styles.label}>Server address</Text>
        <TextInput
          value={value}
          onChangeText={(text) => {
            setValue(text);
            setStatus({ kind: "idle" });
          }}
          editable={loaded}
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="url"
          placeholder="http://192.168.1.20:8000"
          placeholderTextColor={colors.textMuted}
          style={[styles.input, !normalized && value.length > 0 && styles.inputInvalid]}
          accessibilityLabel="Server address"
        />
        {!normalized && value.length > 0 && <Text style={styles.error}>Enter a valid address, e.g. 192.168.1.20:8000</Text>}

        <View style={styles.row}>
          <Pressable
            onPress={test}
            disabled={!normalized || status.kind === "testing"}
            style={[styles.secondary, (!normalized || status.kind === "testing") && styles.disabled]}
            accessibilityRole="button"
          >
            {status.kind === "testing" ? (
              <ActivityIndicator size="small" color={colors.navy} />
            ) : (
              <Ionicons name="pulse-outline" size={18} color={colors.navy} />
            )}
            <Text style={styles.secondaryText}>Test connection</Text>
          </Pressable>
          <Pressable onPress={resetDefault} style={styles.link} accessibilityRole="button">
            <Text style={styles.linkText}>Use default</Text>
          </Pressable>
        </View>

        {status.kind === "ok" && (
          <View style={[styles.statusBox, styles.statusOk]}>
            <Ionicons name="checkmark-circle" size={20} color={colors.safe} />
            <Text style={[styles.statusText, { color: colors.safeDark }]}>Connected to {status.url}</Text>
          </View>
        )}
        {status.kind === "fail" && (
          <View style={[styles.statusBox, styles.statusFail]}>
            <Ionicons name="alert-circle" size={20} color={colors.danger} />
            <Text style={[styles.statusText, { color: colors.dangerDark }]}>
              No response from {status.url}. Check the steps below.
            </Text>
          </View>
        )}

        <View style={styles.help}>
          <Text style={styles.helpTitle}>How to find the address</Text>
          <HelpRow
            icon="laptop-outline"
            text="On the computer, start the backend: cd backend && uvicorn app.main:app --host 0.0.0.0 --port 8000"
          />
          <HelpRow
            icon="wifi-outline"
            text="Connect the phone and the computer to the same Wi-Fi, then use the computer's Wi-Fi IP address, e.g. 192.168.1.20:8000."
          />
          <HelpRow
            icon="phone-portrait-outline"
            text="On an Android emulator the computer is reachable as 10.0.2.2:8000 (the default). Expo web uses localhost:8000."
          />
          <HelpRow icon="shield-checkmark-outline" text="If it still fails, allow port 8000 through the computer's firewall." />
        </View>
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: insets.bottom + spacing.md }]}>
        <Pressable
          onPress={save}
          disabled={!normalized}
          style={[styles.primary, !normalized && styles.disabled]}
          accessibilityRole="button"
        >
          <Text style={styles.primaryText}>Save</Text>
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

function HelpRow({ icon, text }: { icon: keyof typeof Ionicons.glyphMap; text: string }) {
  return (
    <View style={styles.helpRow}>
      <Ionicons name={icon} size={18} color={colors.brandDark} style={styles.helpIcon} />
      <Text style={styles.helpText}>{text}</Text>
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
    gap: spacing.md,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
  },
  iconButton: {
    width: 40,
    height: 40,
    borderRadius: radii.pill,
    backgroundColor: colors.surface,
    alignItems: "center",
    justifyContent: "center",
  },
  title: {
    ...typography.title,
    color: colors.text,
  },
  body: {
    ...typography.body,
    color: colors.textMuted,
  },
  label: {
    ...typography.label,
    color: colors.textMuted,
    marginTop: spacing.sm,
  },
  input: {
    ...typography.body,
    color: colors.text,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    paddingHorizontal: spacing.md,
    paddingVertical: 14,
    backgroundColor: colors.surface,
  },
  inputInvalid: {
    borderColor: colors.danger,
  },
  error: {
    ...typography.caption,
    color: colors.danger,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  secondary: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingVertical: 12,
    paddingHorizontal: spacing.md,
    borderRadius: radii.pill,
    backgroundColor: colors.navySoft,
  },
  secondaryText: {
    ...typography.heading,
    fontSize: 15,
    color: colors.navy,
  },
  link: {
    paddingVertical: 12,
    paddingHorizontal: spacing.sm,
  },
  linkText: {
    ...typography.heading,
    fontSize: 15,
    color: colors.brandDark,
  },
  disabled: {
    opacity: 0.5,
  },
  statusBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: radii.md,
  },
  statusOk: {
    backgroundColor: colors.safeSoft,
  },
  statusFail: {
    backgroundColor: colors.dangerSoft,
  },
  statusText: {
    ...typography.caption,
    flex: 1,
  },
  help: {
    marginTop: spacing.md,
    padding: spacing.lg,
    borderRadius: radii.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    gap: spacing.md,
  },
  helpTitle: {
    ...typography.heading,
    color: colors.text,
  },
  helpRow: {
    flexDirection: "row",
    gap: spacing.sm,
  },
  helpIcon: {
    marginTop: 2,
  },
  helpText: {
    ...typography.caption,
    color: colors.textMuted,
    flex: 1,
  },
  footer: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    backgroundColor: colors.background,
  },
  primary: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 16,
    borderRadius: radii.pill,
    backgroundColor: colors.navy,
  },
  primaryText: {
    ...typography.heading,
    color: colors.white,
  },
});
