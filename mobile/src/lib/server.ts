import AsyncStorage from "@react-native-async-storage/async-storage";
import { Platform } from "react-native";

const STORAGE_KEY = "sanad.apiUrl";

const BUILT_IN_API_URL = Platform.select({
  android: "http://10.0.2.2:8000",
  default: "http://localhost:8000",
});

export const DEFAULT_API_URL = normalizeApiUrl(process.env.EXPO_PUBLIC_API_URL ?? BUILT_IN_API_URL) ?? BUILT_IN_API_URL;

let cached: string | null = null;

export function normalizeApiUrl(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  if (!trimmed) return null;
  const withScheme = /^https?:\/\//i.test(trimmed) ? trimmed : `http://${trimmed}`;
  try {
    const url = new URL(withScheme);
    if (!url.hostname) return null;
    return `${url.protocol}//${url.host}${url.pathname.replace(/\/+$/, "")}`;
  } catch {
    return null;
  }
}

export async function getApiUrl(): Promise<string> {
  if (cached) return cached;
  try {
    cached = normalizeApiUrl(await AsyncStorage.getItem(STORAGE_KEY)) ?? DEFAULT_API_URL;
  } catch {
    cached = DEFAULT_API_URL;
  }
  return cached;
}

export async function setApiUrl(value: string | null): Promise<string> {
  const normalized = normalizeApiUrl(value);
  if (normalized && normalized !== DEFAULT_API_URL) {
    await AsyncStorage.setItem(STORAGE_KEY, normalized);
    cached = normalized;
  } else {
    await AsyncStorage.removeItem(STORAGE_KEY);
    cached = DEFAULT_API_URL;
  }
  return cached;
}

export async function pingApi(baseUrl: string, timeoutMs = 5000): Promise<boolean> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(`${baseUrl}/health`, { signal: controller.signal });
    return response.ok;
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
}
