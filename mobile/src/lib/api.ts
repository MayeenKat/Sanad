import { Platform } from "react-native";

import type { AnalysisResult, ScanDocument } from "./types";

const DEFAULT_API_URL = Platform.select({
  android: "http://10.0.2.2:8000",
  default: "http://localhost:8000",
});

export const API_URL = (process.env.EXPO_PUBLIC_API_URL ?? DEFAULT_API_URL).replace(/\/$/, "");

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
  form.append("files", { uri: doc.uri, name: doc.name, type: doc.mimeType } as unknown as Blob);
}

export async function analyzeDocuments(
  documents: ScanDocument[],
  signal?: AbortSignal,
): Promise<AnalysisResult> {
  const form = new FormData();
  for (const doc of documents) {
    await appendDocument(form, doc);
  }

  let response: Response;
  try {
    response = await fetch(`${API_URL}/analyze`, { method: "POST", body: form, signal });
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") throw error;
    throw new ApiError(
      `Could not reach the SANAD verification service at ${API_URL}. Check your connection and try again.`,
    );
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
