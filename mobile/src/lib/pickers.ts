import * as DocumentPicker from "expo-document-picker";
import * as ImagePicker from "expo-image-picker";

import { newDocumentId } from "./scan-context";
import type { ScanDocument } from "./types";

export const SUPPORTED_MIME_TYPES = ["application/pdf", "image/png", "image/jpeg"];

function guessMimeType(name: string, fallback?: string | null): string {
  if (fallback) return fallback;
  const lower = name.toLowerCase();
  if (lower.endsWith(".pdf")) return "application/pdf";
  if (lower.endsWith(".png")) return "image/png";
  return "image/jpeg";
}

export async function pickFromLibrary(): Promise<ScanDocument[]> {
  const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!permission.granted) return [];
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ["images"],
    allowsMultipleSelection: true,
    selectionLimit: 10,
    quality: 1,
    exif: false,
  });
  if (result.canceled) return [];
  return result.assets.map((asset, index) => {
    const name = asset.fileName ?? `photo-${index + 1}.jpg`;
    return {
      id: newDocumentId(),
      uri: asset.uri,
      name,
      mimeType: guessMimeType(name, asset.mimeType),
      source: "library" as const,
    };
  });
}

export async function pickFiles(): Promise<ScanDocument[]> {
  const result = await DocumentPicker.getDocumentAsync({
    type: SUPPORTED_MIME_TYPES,
    multiple: true,
    copyToCacheDirectory: true,
  });
  if (result.canceled) return [];
  return result.assets.map((asset) => ({
    id: newDocumentId(),
    uri: asset.uri,
    name: asset.name,
    mimeType: guessMimeType(asset.name, asset.mimeType),
    source: "files" as const,
  }));
}
