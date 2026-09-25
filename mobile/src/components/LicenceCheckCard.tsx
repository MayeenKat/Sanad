import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useCallback, useState } from "react";
import { Alert, Pressable, StyleSheet, Text, View } from "react-native";

import {
  FTA_TRN_URL,
  NATIONAL_ECONOMIC_REGISTRY_URL,
  UAE_LICENCE_GUIDE_URL,
  copyIdentifier,
  openOfficialSite,
} from "@/lib/licence";
import { colors, radii, spacing, typography } from "@/lib/theme";
import type { BusinessIdentifiers } from "@/lib/types";

interface LicenceCheckCardProps {
  business?: BusinessIdentifiers;
}

const EMPTY: BusinessIdentifiers = { licence_numbers: [], tax_registration_numbers: [], trade_name: null };

export function LicenceCheckCard({ business = EMPTY }: LicenceCheckCardProps) {
  const [copied, setCopied] = useState<string | null>(null);

  const open = useCallback(async (url: string) => {
    try {
      await openOfficialSite(url);
    } catch {
      Alert.alert("Couldn't open the website", `Visit ${url} in your browser.`);
    }
  }, []);

  const copy = useCallback(async (value: string) => {
    await copyIdentifier(value);
    Haptics.selectionAsync().catch(() => undefined);
    setCopied(value);
    setTimeout(() => setCopied((v) => (v === value ? null : v)), 1600);
  }, []);

  const hasIds = business.licence_numbers.length > 0 || business.tax_registration_numbers.length > 0;

  return (
    <View style={styles.card} accessibilityRole="summary">
      <View style={styles.header}>
        <View style={styles.icon}>
          <Ionicons name="business-outline" size={22} color={colors.navy} />
        </View>
        <View style={styles.headerText}>
          <Text style={styles.title}>Check the issuer&apos;s UAE licence</Text>
          <Text style={styles.subtitle}>
            Confirm the business behind this document is licensed anywhere in the UAE via the National Economic
            Registry of the Ministry of Economy &amp; Tourism.
          </Text>
        </View>
      </View>

      {business.trade_name && (
        <Row label="Trade name" value={business.trade_name} copied={copied} onCopy={copy} />
      )}
      {business.licence_numbers.map((n) => (
        <Row key={n} label="Licence no." value={n} copied={copied} onCopy={copy} />
      ))}
      {business.tax_registration_numbers.map((n) => (
        <Row key={n} label="TRN" value={n} copied={copied} onCopy={copy} />
      ))}

      <Text style={styles.hint}>
        {hasIds
          ? "Copy a number above, then paste it into the registry search. UAE PASS sign-in may be required."
          : "No licence or TRN was printed in the document text. Search by the trade name on the document instead. UAE PASS sign-in may be required."}
      </Text>

      <Pressable
        style={({ pressed }) => [styles.primary, pressed && styles.pressed]}
        onPress={() => open(NATIONAL_ECONOMIC_REGISTRY_URL)}
        accessibilityRole="link"
      >
        <Ionicons name="shield-checkmark-outline" size={18} color={colors.white} />
        <Text style={styles.primaryText}>Verify licence on National Economic Registry</Text>
      </Pressable>

      <View style={styles.links}>
        {business.tax_registration_numbers.length > 0 && (
          <Pressable onPress={() => open(FTA_TRN_URL)} accessibilityRole="link" style={styles.link}>
            <Ionicons name="open-outline" size={14} color={colors.brandDark} />
            <Text style={styles.linkText}>Verify TRN on tax.gov.ae (TRN Verification box)</Text>
          </Pressable>
        )}
        <Pressable onPress={() => open(UAE_LICENCE_GUIDE_URL)} accessibilityRole="link" style={styles.link}>
          <Ionicons name="open-outline" size={14} color={colors.brandDark} />
          <Text style={styles.linkText}>All emirate licence services on u.ae</Text>
        </Pressable>
      </View>
    </View>
  );
}

interface RowProps {
  label: string;
  value: string;
  copied: string | null;
  onCopy: (value: string) => void;
}

function Row({ label, value, copied, onCopy }: RowProps) {
  const isCopied = copied === value;
  return (
    <Pressable
      style={({ pressed }) => [styles.row, pressed && styles.pressed]}
      onPress={() => onCopy(value)}
      accessibilityRole="button"
      accessibilityLabel={`Copy ${label} ${value}`}
    >
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue} numberOfLines={1}>
        {value}
      </Text>
      <View style={[styles.copy, isCopied && styles.copyDone]}>
        <Ionicons name={isCopied ? "checkmark" : "copy-outline"} size={14} color={isCopied ? colors.white : colors.navy} />
        <Text style={[styles.copyText, isCopied && styles.copyTextDone]}>{isCopied ? "Copied" : "Copy"}</Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: radii.lg,
    backgroundColor: colors.navySoft,
    borderWidth: 1,
    borderColor: colors.border,
  },
  header: {
    flexDirection: "row",
    gap: spacing.sm,
    alignItems: "flex-start",
  },
  icon: {
    width: 40,
    height: 40,
    borderRadius: radii.md,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  headerText: {
    flex: 1,
    gap: 2,
  },
  title: {
    ...typography.heading,
    color: colors.text,
  },
  subtitle: {
    ...typography.caption,
    color: colors.textMuted,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radii.md,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.border,
  },
  rowLabel: {
    ...typography.caption,
    color: colors.textMuted,
    width: 82,
  },
  rowValue: {
    ...typography.heading,
    fontSize: 15,
    color: colors.text,
    flex: 1,
    fontVariant: ["tabular-nums"],
  },
  copy: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: radii.pill,
    backgroundColor: colors.navySoft,
  },
  copyDone: {
    backgroundColor: colors.safe,
  },
  copyText: {
    ...typography.caption,
    fontWeight: "700",
    color: colors.navy,
  },
  copyTextDone: {
    color: colors.white,
  },
  hint: {
    ...typography.caption,
    color: colors.textMuted,
  },
  primary: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
    paddingVertical: 14,
    paddingHorizontal: spacing.md,
    borderRadius: radii.pill,
    backgroundColor: colors.navy,
  },
  primaryText: {
    ...typography.heading,
    fontSize: 15,
    color: colors.white,
    textAlign: "center",
  },
  pressed: {
    opacity: 0.8,
  },
  links: {
    gap: spacing.xs,
  },
  link: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    alignSelf: "flex-start",
    paddingVertical: 2,
  },
  linkText: {
    ...typography.caption,
    fontWeight: "700",
    color: colors.brandDark,
  },
});
