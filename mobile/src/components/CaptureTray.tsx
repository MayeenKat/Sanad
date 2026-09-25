import { Ionicons } from "@expo/vector-icons";
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { colors, radii, spacing, typography } from "@/lib/theme";
import type { ScanDocument } from "@/lib/types";

interface CaptureTrayProps {
  documents: ScanDocument[];
  onRemove: (id: string) => void;
  onVerify: () => void;
}

export function CaptureTray({ documents, onRemove, onVerify }: CaptureTrayProps) {
  if (documents.length === 0) return null;
  const label = documents.length === 1 ? "Verify document" : `Verify ${documents.length} pages`;

  return (
    <View style={styles.container}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.strip}>
        {documents.map((doc, index) => (
          <View key={doc.id} style={styles.thumbWrap}>
            {doc.mimeType === "application/pdf" ? (
              <View style={[styles.thumb, styles.pdfThumb]}>
                <Ionicons name="document-text" size={22} color={colors.brand} />
              </View>
            ) : (
              <Image source={{ uri: doc.uri }} style={styles.thumb} />
            )}
            <Text style={styles.pageNumber}>{index + 1}</Text>
            <Pressable
              onPress={() => onRemove(doc.id)}
              style={styles.remove}
              hitSlop={8}
              accessibilityLabel={`Remove page ${index + 1}`}
            >
              <Ionicons name="close" size={14} color={colors.white} />
            </Pressable>
          </View>
        ))}
      </ScrollView>
      <Pressable
        style={({ pressed }) => [styles.verify, pressed && styles.verifyPressed]}
        onPress={onVerify}
        accessibilityRole="button"
      >
        <Ionicons name="shield-checkmark" size={18} color={colors.white} />
        <Text style={styles.verifyText}>{label}</Text>
        <Ionicons name="arrow-forward" size={18} color={colors.white} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: spacing.sm,
  },
  strip: {
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
  },
  thumbWrap: {
    position: "relative",
    paddingTop: 6,
    paddingRight: 6,
  },
  thumb: {
    width: 56,
    height: 72,
    borderRadius: radii.sm,
    borderWidth: 2,
    borderColor: colors.brand,
    backgroundColor: colors.surface,
  },
  pdfThumb: {
    alignItems: "center",
    justifyContent: "center",
  },
  pageNumber: {
    position: "absolute",
    left: 4,
    bottom: 4,
    ...typography.caption,
    fontWeight: "700",
    color: colors.white,
    backgroundColor: colors.overlay,
    paddingHorizontal: 5,
    borderRadius: radii.sm,
  },
  remove: {
    position: "absolute",
    top: 0,
    right: 0,
    width: 20,
    height: 20,
    borderRadius: radii.pill,
    backgroundColor: colors.danger,
    alignItems: "center",
    justifyContent: "center",
  },
  verify: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
    marginHorizontal: spacing.lg,
    paddingVertical: 14,
    borderRadius: radii.pill,
    backgroundColor: colors.navy,
  },
  verifyPressed: {
    opacity: 0.85,
  },
  verifyText: {
    ...typography.heading,
    color: colors.white,
  },
});
