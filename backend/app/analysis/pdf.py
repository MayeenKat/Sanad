from __future__ import annotations

import io
import re

from pypdf import PdfReader
from pypdf.errors import PdfReadError

from app.analysis.common import (
    check_dates,
    check_text_content,
    editing_software_match,
    parse_datetime,
    software_findings,
)
from app.models import DocumentReport, Finding, Severity

_EOF = re.compile(rb"%%EOF")
_XMP_TOOL = re.compile(
    r"(?:xmp:CreatorTool|pdf:Producer|stEvt:softwareAgent)\s*=\s*\"([^\"]+)\"|"
    r"<(?:xmp:CreatorTool|pdf:Producer|stEvt:softwareAgent)>([^<]+)<",
    re.IGNORECASE,
)


def analyze_pdf(data: bytes, filename: str, mime_type: str) -> DocumentReport:
    report = DocumentReport(filename=filename, kind="pdf", mime_type=mime_type, size_bytes=len(data))
    try:
        reader = PdfReader(io.BytesIO(data))
        if reader.is_encrypted:
            try:
                reader.decrypt("")
            except Exception:  # noqa: BLE001
                pass
        info = reader.metadata or {}
        pages = list(reader.pages)
    except (PdfReadError, ValueError, KeyError, TypeError, OSError):
        report.findings.append(
            Finding(
                code="unreadable_pdf",
                severity=Severity.HIGH,
                title="PDF could not be parsed",
                detail="The file is not a well-formed PDF. Corrupted structure is common in hand-edited files.",
            )
        )
        return report

    producer = _clean(info.get("/Producer"))
    creator = _clean(info.get("/Creator"))
    author = _clean(info.get("/Author"))
    title = _clean(info.get("/Title"))
    created = parse_datetime(_clean(info.get("/CreationDate")))
    modified = parse_datetime(_clean(info.get("/ModDate")))

    report.metadata["pages"] = str(len(pages))
    for key, value in (("producer", producer), ("creator", creator), ("author", author), ("title", title)):
        if value:
            report.metadata[key] = value
    if created:
        report.metadata["created"] = f"{created:%Y-%m-%d %H:%M} UTC"
    if modified:
        report.metadata["modified"] = f"{modified:%Y-%m-%d %H:%M} UTC"

    flagged = False
    for source, value in (("producer", producer), ("creator", creator)):
        found = software_findings(f"PDF {source}", value)
        if found:
            report.findings.extend(found)
            flagged = True
            break

    report.findings.extend(check_dates(created, modified))

    xmp = _extract_xmp(data)
    if xmp and not flagged:
        for m in _XMP_TOOL.finditer(xmp):
            tool = m.group(1) or m.group(2)
            if editing_software_match(tool):
                report.findings.extend(software_findings("XMP", tool))
                break

    eof_count = len(_EOF.findall(data))
    has_prev = b"/Prev" in data
    if eof_count > 1 and has_prev:
        report.metadata["revisions"] = str(eof_count)
        report.findings.append(
            Finding(
                code="incremental_updates",
                severity=Severity.HIGH if eof_count > 2 else Severity.MEDIUM,
                title="File was saved again after it was issued",
                detail=(
                    f"The PDF contains {eof_count} revisions layered on top of the original. "
                    "Each revision is a later edit; genuine receipts and certificates have one."
                ),
            )
        )

    signed = _has_signature(reader)
    report.metadata["digitally_signed"] = "yes" if signed else "no"
    if signed and eof_count > 2:
        report.findings.append(
            Finding(
                code="modified_after_signing",
                severity=Severity.CRITICAL,
                title="Document changed after it was digitally signed",
                detail="Edits were saved on top of a signed version, which invalidates the issuer's signature.",
            )
        )

    annots = _annotation_findings(pages)
    report.findings.extend(annots)

    text = ""
    for page in pages[:10]:
        try:
            text += (page.extract_text() or "") + "\n"
        except Exception:  # noqa: BLE001 - pypdf can fail on exotic fonts
            continue
    report.findings.extend(check_text_content(text))

    if not text.strip() and pages:
        report.findings.append(
            Finding(
                code="image_only_pdf",
                severity=Severity.LOW,
                title="PDF contains only images, no text layer",
                detail="System-generated receipts contain real text. A scanned or screenshot PDF cannot be verified from its content.",
            )
        )

    return report


def _clean(value: object) -> str | None:
    if value is None:
        return None
    text = str(value).strip()
    return text or None


def _extract_xmp(data: bytes) -> str:
    start = data.find(b"<x:xmpmeta")
    if start == -1:
        return ""
    end = data.find(b"</x:xmpmeta>", start)
    return data[start : end + 12].decode("utf-8", errors="ignore") if end != -1 else ""


def _has_signature(reader: PdfReader) -> bool:
    try:
        root = reader.trailer["/Root"]
        acro = root.get("/AcroForm")
        if acro is None:
            return False
        acro = acro.get_object()
        if acro.get("/SigFlags", 0):
            return True
        for field in acro.get("/Fields", []):
            if field.get_object().get("/FT") == "/Sig":
                return True
    except Exception:  # noqa: BLE001
        return False
    return False


def _annotation_findings(pages: list) -> list[Finding]:
    overlays = 0
    redactions = 0
    for page in pages:
        try:
            annots = page.get("/Annots") or []
            for ref in annots:
                annot = ref.get_object()
                subtype = annot.get("/Subtype")
                if subtype in ("/FreeText", "/Stamp", "/Square"):
                    overlays += 1
                elif subtype == "/Redact":
                    redactions += 1
        except Exception:  # noqa: BLE001
            continue
    findings: list[Finding] = []
    if overlays:
        findings.append(
            Finding(
                code="overlay_annotations",
                severity=Severity.HIGH,
                title="Text or shapes were placed over the original content",
                detail=(
                    f"{overlays} annotation(s) of type text-box/stamp/rectangle sit on top of the page. "
                    "This is the usual way amounts, names or dates are covered and replaced."
                ),
            )
        )
    if redactions:
        findings.append(
            Finding(
                code="redaction_annotations",
                severity=Severity.HIGH,
                title="Redaction marks found",
                detail=f"{redactions} redaction annotation(s) hide part of the original document.",
            )
        )
    return findings
