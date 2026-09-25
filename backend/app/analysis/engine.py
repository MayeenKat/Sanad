from __future__ import annotations

from app.analysis.image import analyze_image
from app.analysis.pdf import analyze_pdf
from app.models import (
    FRAUD_THRESHOLD,
    AnalysisResult,
    DocumentReport,
    Finding,
    Severity,
    Verdict,
)

SUPPORTED_MIME_TYPES = {
    "application/pdf": "pdf",
    "image/jpeg": "image",
    "image/jpg": "image",
    "image/png": "image",
    "image/heic": "image",
    "image/heif": "image",
    "image/webp": "image",
}


def sniff_kind(data: bytes, mime_type: str | None, filename: str) -> str | None:
    head = data[:16]
    if head.startswith(b"%PDF"):
        return "pdf"
    if head.startswith(b"\xff\xd8\xff") or head.startswith(b"\x89PNG") or head[:4] == b"RIFF":
        return "image"
    if head[4:12] in (b"ftypheic", b"ftypheix", b"ftypmif1", b"ftypheif"):
        return "image"
    if mime_type in SUPPORTED_MIME_TYPES:
        return SUPPORTED_MIME_TYPES[mime_type]
    lowered = filename.lower()
    if lowered.endswith(".pdf"):
        return "pdf"
    if lowered.endswith((".jpg", ".jpeg", ".png", ".heic", ".webp")):
        return "image"
    return None


class UnsupportedFormatError(ValueError):
    def __init__(self, filename: str) -> None:
        super().__init__(f"'{filename}' is not a supported format. SANAD can verify PDF, JPEG and PNG files.")


def analyze_document(data: bytes, filename: str, mime_type: str | None) -> DocumentReport:
    kind = sniff_kind(data, mime_type, filename)
    mime = mime_type or "application/octet-stream"
    if kind == "pdf":
        return analyze_pdf(data, filename, mime)
    if kind == "image":
        return analyze_image(data, filename, mime)
    raise UnsupportedFormatError(filename)


def aggregate(reports: list[DocumentReport]) -> AnalysisResult:
    findings: list[Finding] = []
    seen: set[tuple[str, str]] = set()
    for report in reports:
        for finding in report.findings:
            key = (finding.code, finding.detail)
            if key in seen:
                continue
            seen.add(key)
            findings.append(finding)

    order = [Severity.CRITICAL, Severity.HIGH, Severity.MEDIUM, Severity.LOW, Severity.INFO]
    findings.sort(key=lambda f: order.index(f.severity))

    score = min(100, max((r.score for r in reports), default=0))
    if score >= FRAUD_THRESHOLD:
        verdict = Verdict.FRAUD
        summary = _fraud_summary(findings)
    else:
        verdict = Verdict.AUTHENTIC
        summary = (
            "No signs of editing or tampering were found in the document content or metadata."
            if not findings
            else "Only minor observations were found; nothing indicates the document was forged."
        )
    return AnalysisResult(
        verdict=verdict,
        risk_score=score,
        summary=summary,
        documents=reports,
        findings=findings,
    )


def _fraud_summary(findings: list[Finding]) -> str:
    strong = [f for f in findings if f.severity in (Severity.CRITICAL, Severity.HIGH)]
    if strong:
        lead = strong[0].title.rstrip(".")
        return f"{lead}. This document was not produced as-is by its claimed issuer."
    return "Multiple inconsistencies indicate this document was altered after it was issued."
