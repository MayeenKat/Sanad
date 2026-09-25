import { File as LocalFile } from "expo-file-system";
import { Platform } from "react-native";

import { getApiUrl } from "./server";
import type { AnalysisResult, ScanDocument } from "./types";

const REQUEST_TIMEOUT_MS = 30_000;

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status?: number,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

async function appendDocument(form: FormData, doc: ScanDocument): Promise<void> {
  if (Platform.OS === "web") {
    const blob = await (await fetch(doc.uri)).blob();
    form.append("files", new File([blob], doc.name, { type: doc.mimeType }));
    return;
  }
  // Expo's fetch serialises multipart parts itself and only accepts Blob-like values
  // (anything exposing `bytes()`), not React Native's legacy `{ uri }` descriptors.
  const file = new LocalFile(doc.uri);
  const part = { name: doc.name, type: doc.mimeType, bytes: () => file.bytes() };
  form.append("files", part as unknown as Blob);
}

export async function analyzeDocuments(
  documents: ScanDocument[],
  signal?: AbortSignal,
): Promise<AnalysisResult> {
  const apiUrl = await getApiUrl();
  const form = new FormData();
  for (const doc of documents) {
    await appendDocument(form, doc);
  }

  const controller = new AbortController();
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, REQUEST_TIMEOUT_MS);
  const onOuterAbort = () => controller.abort();
  signal?.addEventListener("abort", onOuterAbort);

  let response: Response;
  try {
    response = await fetch(`${apiUrl}/analyze`, { method: "POST", body: form, signal: controller.signal });
  } catch (error) {
    if (timedOut) {
      throw new ApiError(
        `The SANAD verification service at ${apiUrl} did not respond within ${REQUEST_TIMEOUT_MS / 1000} seconds. ` +
          "Make sure the backend is running and that the server address points to it.",
      );
    }
    if (signal?.aborted || (error instanceof Error && error.name === "AbortError")) throw error;
    const reason = error instanceof Error && error.message ? ` (${error.message})` : "";
    throw new ApiError(
      `Could not reach the SANAD verification service at ${apiUrl}. Check your connection and the server address.${reason}`,
    );
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener("abort", onOuterAbort);
  }

  if (!response.ok) {
    let detail = `The verification service returned an error (${response.status}).`;
    try {
      const body = (await response.json()) as { detail?: string };
      if (typeof body.detail === "string") detail = body.detail;
    } catch {
      // keep default message
    }
    throw new ApiError(detail, response.status);
  }

  return (await response.json()) as AnalysisResult;
}
