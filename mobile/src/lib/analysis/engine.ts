import type { AnalysisResult, BusinessIdentifiers, DocumentReport, Finding, Severity } from "../types";
import { emptyBusiness, FRAUD_THRESHOLD, latin1, SEVERITY_WEIGHTS } from "./common";
import { analyzeImage } from "./image";
import { analyzePdf } from "./pdf";

const SUPPORTED_MIME_TYPES: Record<string, "pdf" | "image"> = {
  "application/pdf": "pdf",
  "image/jpeg": "image",
  "image/jpg": "image",
  "image/png": "image",
  "image/heic": "image",
  "image/heif": "image",
  "image/webp": "image",
};

export class UnsupportedFormatError extends Error {
  constructor(filename: string) {
    super(`'${filename}' is not a supported format. SANAD can verify PDF, JPEG and PNG files.`);
    this.name = "UnsupportedFormatError";
  }
}

export function sniffKind(data: Uint8Array, mimeType: string | null, filename: string): "pdf" | "image" | null {
  const head = latin1(data, 0, Math.min(16, data.length));
  if (head.startsWith("%PDF")) return "pdf";
  if (head.startsWith("\xff\xd8\xff") || head.startsWith("\x89PNG") || head.startsWith("RIFF")) return "image";
  if (["ftypheic", "ftypheix", "ftypmif1", "ftypheif"].includes(head.slice(4, 12))) return "image";
  if (mimeType && SUPPORTED_MIME_TYPES[mimeType]) return SUPPORTED_MIME_TYPES[mimeType];
  const lowered = filename.toLowerCase();
  if (lowered.endsWith(".pdf")) return "pdf";
  if ([".jpg", ".jpeg", ".png", ".heic", ".webp"].some((ext) => lowered.endsWith(ext))) return "image";
  return null;
}

export async function analyzeDocument(
  data: Uint8Array,
  filename: string,
  mimeType: string | null,
): Promise<DocumentReport> {
  const kind = sniffKind(data, mimeType, filename);
  const mime = mimeType ?? "application/octet-stream";
  if (kind === "pdf") return analyzePdf(data, filename, mime);
  if (kind === "image") return analyzeImage(data, filename, mime);
  throw new UnsupportedFormatError(filename);
}

const ORDER: Severity[] = ["critical", "high", "medium", "low", "info"];

export function reportScore(report: DocumentReport): number {
  return report.findings.reduce((sum, f) => sum + SEVERITY_WEIGHTS[f.severity], 0);
}

export function aggregate(reports: DocumentReport[]): AnalysisResult {
  const findings: Finding[] = [];
  const seen = new Set<string>();
  for (const report of reports) {
    for (const f of report.findings) {
      const key = `${f.code}\u0000${f.detail}`;
      if (seen.has(key)) continue;
      seen.add(key);
      findings.push(f);
    }
  }
  findings.sort((a, b) => ORDER.indexOf(a.severity) - ORDER.indexOf(b.severity));

  const score = Math.min(100, Math.max(0, ...reports.map(reportScore)));
  const fraud = score >= FRAUD_THRESHOLD;
  const summary = fraud
    ? fraudSummary(findings)
    : findings.length === 0
      ? "No signs of editing or tampering were found in the document content or metadata."
      : "Only minor observations were found; nothing indicates the document was forged.";

  return {
    verdict: fraud ? "fraud" : "authentic",
    risk_score: score,
    summary,
    documents: reports,
    findings,
    business: mergeBusiness(reports),
  };
}

function mergeBusiness(reports: DocumentReport[]): BusinessIdentifiers {
  const merged = emptyBusiness();
  for (const report of reports) {
    for (const n of report.business.licence_numbers)
      if (!merged.licence_numbers.includes(n)) merged.licence_numbers.push(n);
    for (const t of report.business.tax_registration_numbers) {
      if (!merged.tax_registration_numbers.includes(t)) merged.tax_registration_numbers.push(t);
    }
    merged.trade_name ??= report.business.trade_name;
  }
  return merged;
}

function fraudSummary(findings: Finding[]): string {
  const strong = findings.find((f) => f.severity === "critical" || f.severity === "high");
  if (strong) return `${strong.title.replace(/\.+$/, "")}. This document was not produced as-is by its claimed issuer.`;
  return "Multiple inconsistencies indicate this document was altered after it was issued.";
}
