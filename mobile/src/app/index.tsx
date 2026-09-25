import { Ionicons } from "@expo/vector-icons";
import { CameraView, useCameraPermissions } from "expo-camera";
import * as Haptics from "expo-haptics";
import { router, useFocusEffect } from "expo-router";
import { useCallback, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Alert, Animated, PanResponder, Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { CaptureTray } from "@/components/CaptureTray";
import { UploadSheet } from "@/components/UploadSheet";
import { pickFiles, pickFromLibrary } from "@/lib/pickers";
import { newDocumentId, useScan } from "@/lib/scan-context";
import { colors, radii, spacing, typography } from "@/lib/theme";
import type { ScanDocument } from "@/lib/types";

const SWIPE_UP_DISTANCE = 70;
const SWIPE_UP_VELOCITY = 0.35;

export default function CameraScreen() {
  const insets = useSafeAreaInsets();
  const [permission, requestPermission] = useCameraPermissions();
  const { documents, addDocuments, removeDocument, result, reset } = useScan();
  const cameraRef = useRef<CameraView>(null);
  const [cameraReady, setCameraReady] = useState(false);
  const [capturing, setCapturing] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [torch, setTorch] = useState(false);
  const [flash] = useState(() => new Animated.Value(0));

  useFocusEffect(
    useCallback(() => {
      if (result) reset();
    }, [result, reset]),
  );

  const openSheet = useCallback(() => setSheetOpen(true), []);
  const closeSheet = useCallback(() => setSheetOpen(false), []);

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_evt, gesture) =>
          Math.abs(gesture.dy) > 12 && Math.abs(gesture.dy) > Math.abs(gesture.dx) * 1.5,
        onPanResponderRelease: (_evt, gesture) => {
          if (gesture.dy < -SWIPE_UP_DISTANCE || gesture.vy < -SWIPE_UP_VELOCITY) {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined);
            openSheet();
          }
        },
      }),
    [openSheet],
  );

  const goVerify = useCallback(
    (docs: ScanDocument[]) => {
      if (docs.length === 0) return;
      router.push("/analyzing");
    },
    [],
  );

  const handleCapture = useCallback(async () => {
    if (!cameraRef.current || !cameraReady || capturing) return;
    setCapturing(true);
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => undefined);
      Animated.sequence([
        Animated.timing(flash, { toValue: 1, duration: 60, useNativeDriver: true }),
        Animated.timing(flash, { toValue: 0, duration: 200, useNativeDriver: true }),
      ]).start();
      const photo = await cameraRef.current.takePictureAsync({ quality: 0.95, exif: true });
      if (photo?.uri) {
        addDocuments([
          {
            id: newDocumentId(),
            uri: photo.uri,
            name: `scan-${documents.length + 1}.jpg`,
            mimeType: "image/jpeg",
            source: "camera",
          },
        ]);
      }
    } catch {
      Alert.alert("Couldn't take the photo", "Please try again.");
    } finally {
      setCapturing(false);
    }
  }, [addDocuments, cameraReady, capturing, documents.length, flash]);

  const handlePickPhotos = useCallback(async () => {
    closeSheet();
    const picked = await pickFromLibrary();
    if (picked.length) {
      addDocuments(picked);
      goVerify(picked);
    }
  }, [addDocuments, closeSheet, goVerify]);

  const handlePickFiles = useCallback(async () => {
    closeSheet();
    const picked = await pickFiles();
    if (picked.length) {
      addDocuments(picked);
      goVerify(picked);
    }
  }, [addDocuments, closeSheet, goVerify]);

  const showCamera = permission?.granted === true;

  return (
    <View style={styles.root}>
      {showCamera ? (
        <CameraView
          ref={cameraRef}
          style={StyleSheet.absoluteFill}
          facing="back"
          enableTorch={torch}
          onCameraReady={() => setCameraReady(true)}
        />
      ) : (
        <PermissionPlaceholder
          status={permission?.status}
          canAskAgain={permission?.canAskAgain ?? true}
          onRequest={requestPermission}
        />
      )}

      <Animated.View pointerEvents="none" style={[styles.flash, { opacity: flash }]} />

      <View style={styles.overlay} {...panResponder.panHandlers}>
        <View style={[styles.topBar, { paddingTop: insets.top + spacing.sm }]}>
          <View>
            <Text style={styles.brand}>SANAD</Text>
            <Text style={styles.tagline}>Scan a document to check it&apos;s genuine</Text>
          </View>
          {showCamera && (
            <Pressable
              onPress={() => setTorch((t) => !t)}
              style={styles.iconButton}
              accessibilityRole="button"
              accessibilityLabel={torch ? "Turn torch off" : "Turn torch on"}
            >
              <Ionicons name={torch ? "flash" : "flash-off"} size={20} color={colors.white} />
            </Pressable>
          )}
        </View>

        {showCamera && documents.length === 0 && (
          <View style={styles.frameWrap} pointerEvents="none">
            <View style={styles.frame}>
              <View style={[styles.corner, styles.cornerTL]} />
              <View style={[styles.corner, styles.cornerTR]} />
              <View style={[styles.corner, styles.cornerBL]} />
              <View style={[styles.corner, styles.cornerBR]} />
            </View>
            <Text style={styles.frameHint}>Fit the receipt or document inside the frame</Text>
          </View>
        )}

        <View style={[styles.bottom, { paddingBottom: insets.bottom + spacing.md }]}>
          <CaptureTray documents={documents} onRemove={removeDocument} onVerify={() => goVerify(documents)} />

          <Pressable onPress={openSheet} style={styles.swipeHint} accessibilityLabel="Swipe up to upload">
            <Ionicons name="chevron-up" size={18} color={colors.textMuted} />
            <Text style={styles.swipeHintText}>Swipe up to upload a PDF or image</Text>
          </Pressable>

          <View style={styles.controls}>
            <Pressable
              onPress={openSheet}
              style={({ pressed }) => [styles.sideButton, pressed && styles.pressed]}
              accessibilityRole="button"
              accessibilityLabel="Upload a document"
            >
              <Ionicons name="attach" size={26} color={colors.white} />
            </Pressable>

            <Pressable
              onPress={handleCapture}
              disabled={!showCamera || !cameraReady || capturing}
              style={({ pressed }) => [styles.shutterOuter, pressed && styles.shutterPressed, !showCamera && styles.disabled]}
              accessibilityRole="button"
              accessibilityLabel="Take photo"
            >
              <View style={styles.shutterInner}>
                {capturing && <ActivityIndicator color={colors.background} />}
              </View>
            </Pressable>

            <View style={styles.sideButtonGhost}>
              {documents.length > 0 && (
                <View style={styles.countBadge}>
                  <Text style={styles.countText}>{documents.length}</Text>
                </View>
              )}
            </View>
          </View>
        </View>
      </View>

      <UploadSheet
        visible={sheetOpen}
        onClose={closeSheet}
        onPickPhotos={handlePickPhotos}
        onPickFiles={handlePickFiles}
      />
    </View>
  );
}

interface PermissionPlaceholderProps {
  status?: string;
  canAskAgain: boolean;
  onRequest: () => void;
}

function PermissionPlaceholder({ status, canAskAgain, onRequest }: PermissionPlaceholderProps) {
  const denied = status === "denied";
  return (
    <View style={styles.permission}>
      <View style={styles.permissionIcon}>
        <Ionicons name="camera-outline" size={40} color={colors.brand} />
      </View>
      <Text style={styles.permissionTitle}>Camera access needed</Text>
      <Text style={styles.permissionBody}>
        SANAD scans documents with your camera to check whether they are genuine. You can also upload a PDF or image
        using the attachment button below.
      </Text>
      {(!denied || canAskAgain) && (
        <Pressable style={styles.permissionButton} onPress={onRequest} accessibilityRole="button">
          <Text style={styles.permissionButtonText}>Allow camera</Text>
        </Pressable>
      )}
      {denied && !canAskAgain && (
        <Text style={styles.permissionBody}>Enable the camera for SANAD in your device settings.</Text>
      )}
    </View>
  );
}

const CORNER = 28;

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.background,
  },
  flash: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: colors.white,
  },
  overlay: {
    flex: 1,
    justifyContent: "space-between",
  },
  topBar: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
  },
  brand: {
    ...typography.display,
    color: colors.white,
    letterSpacing: 4,
  },
  tagline: {
    ...typography.caption,
    color: colors.textMuted,
  },
  iconButton: {
    width: 40,
    height: 40,
    borderRadius: radii.pill,
    backgroundColor: colors.overlay,
    alignItems: "center",
    justifyContent: "center",
  },
  frameWrap: {
    alignItems: "center",
    gap: spacing.md,
  },
  frame: {
    width: "78%",
    aspectRatio: 0.72,
  },
  corner: {
    position: "absolute",
    width: CORNER,
    height: CORNER,
    borderColor: colors.brand,
  },
  cornerTL: { top: 0, left: 0, borderTopWidth: 3, borderLeftWidth: 3, borderTopLeftRadius: 8 },
  cornerTR: { top: 0, right: 0, borderTopWidth: 3, borderRightWidth: 3, borderTopRightRadius: 8 },
  cornerBL: { bottom: 0, left: 0, borderBottomWidth: 3, borderLeftWidth: 3, borderBottomLeftRadius: 8 },
  cornerBR: { bottom: 0, right: 0, borderBottomWidth: 3, borderRightWidth: 3, borderBottomRightRadius: 8 },
  frameHint: {
    ...typography.caption,
    color: colors.white,
    backgroundColor: colors.overlay,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radii.pill,
  },
  bottom: {
    gap: spacing.md,
    paddingTop: spacing.md,
  },
  swipeHint: {
    alignItems: "center",
    gap: 2,
  },
  swipeHintText: {
    ...typography.caption,
    color: colors.textMuted,
  },
  controls: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.xl,
  },
  sideButton: {
    width: 56,
    height: 56,
    borderRadius: radii.pill,
    backgroundColor: colors.overlay,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.25)",
    alignItems: "center",
    justifyContent: "center",
  },
  sideButtonGhost: {
    width: 56,
    height: 56,
    alignItems: "center",
    justifyContent: "center",
  },
  countBadge: {
    minWidth: 32,
    height: 32,
    paddingHorizontal: spacing.sm,
    borderRadius: radii.pill,
    backgroundColor: colors.brand,
    alignItems: "center",
    justifyContent: "center",
  },
  countText: {
    ...typography.heading,
    color: colors.background,
  },
  pressed: {
    opacity: 0.7,
  },
  disabled: {
    opacity: 0.4,
  },
  shutterOuter: {
    width: 84,
    height: 84,
    borderRadius: radii.pill,
    borderWidth: 4,
    borderColor: colors.white,
    alignItems: "center",
    justifyContent: "center",
  },
  shutterPressed: {
    transform: [{ scale: 0.94 }],
  },
  shutterInner: {
    width: 66,
    height: 66,
    borderRadius: radii.pill,
    backgroundColor: colors.white,
    alignItems: "center",
    justifyContent: "center",
  },
  permission: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing.xl,
    gap: spacing.md,
  },
  permissionIcon: {
    width: 88,
    height: 88,
    borderRadius: radii.pill,
    backgroundColor: colors.brandSoft,
    alignItems: "center",
    justifyContent: "center",
  },
  permissionTitle: {
    ...typography.title,
    color: colors.text,
    textAlign: "center",
  },
  permissionBody: {
    ...typography.body,
    color: colors.textMuted,
    textAlign: "center",
  },
  permissionButton: {
    marginTop: spacing.sm,
    paddingHorizontal: spacing.xl,
    paddingVertical: 14,
    borderRadius: radii.pill,
    backgroundColor: colors.brand,
  },
  permissionButtonText: {
    ...typography.heading,
    color: colors.background,
  },
});
