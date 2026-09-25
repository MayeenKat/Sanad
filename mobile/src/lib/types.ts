export type Severity = "critical" | "high" | "medium" | "low" | "info";

export type Verdict = "fraud" | "authentic";

export interface Finding {
  code: string;
  severity: Severity;
  title: string;
  detail: string;
}

export interface DocumentReport {
  filename: string;
  kind: "pdf" | "image" | "unknown";
  mime_type: string;
  size_bytes: number;
  metadata: Record<string, string>;
  findings: Finding[];
}

export interface AnalysisResult {
  verdict: Verdict;
  risk_score: number;
  summary: string;
  documents: DocumentReport[];
  findings: Finding[];
}

export interface ScanDocument {
  id: string;
  uri: string;
  name: string;
  mimeType: string;
  source: "camera" | "library" | "files";
}
