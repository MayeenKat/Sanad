import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";

import type { AnalysisResult, ScanDocument } from "./types";

interface ScanState {
  documents: ScanDocument[];
  result: AnalysisResult | null;
  addDocuments: (docs: ScanDocument[]) => void;
  removeDocument: (id: string) => void;
  clearDocuments: () => void;
  setResult: (result: AnalysisResult | null) => void;
  reset: () => void;
}

const ScanContext = createContext<ScanState | null>(null);

export function ScanProvider({ children }: { children: ReactNode }) {
  const [documents, setDocuments] = useState<ScanDocument[]>([]);
  const [result, setResult] = useState<AnalysisResult | null>(null);

  const addDocuments = useCallback((docs: ScanDocument[]) => {
    setDocuments((prev) => [...prev, ...docs]);
  }, []);
  const removeDocument = useCallback((id: string) => {
    setDocuments((prev) => prev.filter((d) => d.id !== id));
  }, []);
  const clearDocuments = useCallback(() => setDocuments([]), []);
  const reset = useCallback(() => {
    setDocuments([]);
    setResult(null);
  }, []);

  const value = useMemo(
    () => ({ documents, result, addDocuments, removeDocument, clearDocuments, setResult, reset }),
    [documents, result, addDocuments, removeDocument, clearDocuments, reset],
  );

  return <ScanContext.Provider value={value}>{children}</ScanContext.Provider>;
}

export function useScan(): ScanState {
  const ctx = useContext(ScanContext);
  if (!ctx) throw new Error("useScan must be used inside <ScanProvider>");
  return ctx;
}

let counter = 0;
export function newDocumentId(): string {
  counter += 1;
  return `${Date.now().toString(36)}-${counter}`;
}
