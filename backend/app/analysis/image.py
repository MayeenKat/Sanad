from __future__ import annotations

import io
import re

import numpy as np
from PIL import Image, ImageChops, UnidentifiedImageError
from PIL.ExifTags import TAGS

from app.analysis.common import (
    check_dates,
    parse_datetime,
    software_findings,
)
from app.models import DocumentReport, Finding, Severity

_XMP_SOFTWARE = re.compile(
    r"(?:xmp:CreatorTool|stEvt:softwareAgent|xmp:ModifyDate)\s*=\s*\"([^\"]+)\"|"
    r"<(?:xmp:CreatorTool|stEvt:softwareAgent)>([^<]+)<",
    re.IGNORECASE,
)
_XMP_HISTORY = re.compile(r"xmpMM:History|stEvt:action\s*=\s*\"(?:saved|edited|converted)\"", re.IGNORECASE)
_PHOTOSHOP_MARKER = re.compile(rb"Photoshop 3\.0|8BIM|Adobe Photoshop|photoshop:", re.IGNORECASE)


def analyze_image(data: bytes, filename: str, mime_type: str) -> DocumentReport:
    report = DocumentReport(filename=filename, kind="image", mime_type=mime_type, size_bytes=len(data))
    try:
        img = Image.open(io.BytesIO(data))
        img.load()
    except (UnidentifiedImageError, OSError):
        report.findings.append(
            Finding(
                code="unreadable_image",
                severity=Severity.HIGH,
                title="Image could not be decoded",
                detail="The file is not a valid image, or it has been corrupted.",
            )
        )
        return report

    report.metadata["format"] = img.format or "unknown"
    report.metadata["dimensions"] = f"{img.width}x{img.height}"

    exif = _read_exif(img)
    software = exif.get("Software")
    if software:
        report.metadata["software"] = software
    if exif.get("Make") or exif.get("Model"):
        report.metadata["camera"] = " ".join(v for v in (exif.get("Make"), exif.get("Model")) if v)
    created = parse_datetime(exif.get("DateTimeOriginal") or exif.get("DateTimeDigitized"))
    modified = parse_datetime(exif.get("DateTime"))
    if created:
        report.metadata["captured"] = f"{created:%Y-%m-%d %H:%M} UTC"
    if modified:
        report.metadata["modified"] = f"{modified:%Y-%m-%d %H:%M} UTC"

    report.findings.extend(software_findings("image", software))
    report.findings.extend(check_dates(created, modified))

    xmp = _read_xmp(img, data)
    if xmp:
        report.findings.extend(_xmp_findings(xmp, already_flagged=bool(software)))

    if img.format == "PNG":
        png_software = img.info.get("Software") or img.info.get("Comment")
        if isinstance(png_software, str):
            report.metadata.setdefault("software", png_software)
            if not software:
                report.findings.extend(software_findings("image", png_software))

    if _PHOTOSHOP_MARKER.search(data) and not any(f.code == "editing_software" for f in report.findings):
        report.findings.append(
            Finding(
                code="photoshop_segment",
                severity=Severity.HIGH,
                title="Adobe Photoshop data embedded in the file",
                detail="The image contains Photoshop resource blocks, which are only written when a file is saved from Photoshop.",
            )
        )

    if img.format == "JPEG":
        report.findings.extend(_error_level_analysis(img))

    return report


def _read_exif(img: Image.Image) -> dict[str, str]:
    result: dict[str, str] = {}
    try:
        raw = img.getexif()
    except Exception:  # noqa: BLE001 - Pillow raises assorted errors on broken EXIF
        return result
    for tag_id, value in raw.items():
        name = TAGS.get(tag_id, str(tag_id))
        if isinstance(value, bytes):
            continue
        result[name] = str(value).strip("\x00 ")
    try:
        for tag_id, value in raw.get_ifd(0x8769).items():
            name = TAGS.get(tag_id, str(tag_id))
            if isinstance(value, bytes):
                continue
            result[name] = str(value).strip("\x00 ")
    except Exception:  # noqa: BLE001
        pass
    return result


def _read_xmp(img: Image.Image, data: bytes) -> str:
    xmp = img.info.get("xmp") or img.info.get("XML:com.adobe.xmp")
    if isinstance(xmp, bytes):
        return xmp.decode("utf-8", errors="ignore")
    if isinstance(xmp, str):
        return xmp
    start = data.find(b"<x:xmpmeta")
    if start == -1:
        return ""
    end = data.find(b"</x:xmpmeta>", start)
    return data[start : end + 12].decode("utf-8", errors="ignore") if end != -1 else ""


def _xmp_findings(xmp: str, *, already_flagged: bool) -> list[Finding]:
    findings: list[Finding] = []
    tools = {m.group(1) or m.group(2) for m in _XMP_SOFTWARE.finditer(xmp)}
    tools.discard(None)
    if not already_flagged:
        for tool in tools:
            found = software_findings("XMP", tool)
            if found:
                findings.extend(found)
                break
    if _XMP_HISTORY.search(xmp):
        findings.append(
            Finding(
                code="xmp_edit_history",
                severity=Severity.MEDIUM,
                title="Embedded edit history found",
                detail="The image carries an XMP editing history, meaning it was opened and saved by an editor after it was produced.",
            )
        )
    return findings


def _error_level_analysis(img: Image.Image, quality: int = 90) -> list[Finding]:
    """Detect localized re-compression artefacts, a hallmark of spliced or retouched regions."""
    rgb = img.convert("RGB")
    if rgb.width * rgb.height > 4_000_000:
        scale = (4_000_000 / (rgb.width * rgb.height)) ** 0.5
        rgb = rgb.resize((max(1, int(rgb.width * scale)), max(1, int(rgb.height * scale))))
    buf = io.BytesIO()
    rgb.save(buf, "JPEG", quality=quality)
    buf.seek(0)
    resaved = Image.open(buf).convert("RGB")
    diff = np.asarray(ImageChops.difference(rgb, resaved), dtype=np.float32).mean(axis=2)

    block = 32
    h, w = diff.shape
    if h < block * 4 or w < block * 4:
        return []
    blocks = diff[: h // block * block, : w // block * block]
    blocks = blocks.reshape(h // block, block, w // block, block).mean(axis=(1, 3))
    flat = blocks.flatten()
    median = float(np.median(flat))
    mad = float(np.median(np.abs(flat - median))) or 1e-3
    robust_z = (flat - median) / (1.4826 * mad)
    outliers = float((robust_z > 6).mean())
    peak = float(robust_z.max())

    if median < 0.05:
        return []
    if outliers > 0.03 and peak > 15:
        return [
            Finding(
                code="ela_inconsistent",
                severity=Severity.MEDIUM,
                title="Compression levels differ across the image",
                detail=(
                    f"Error-level analysis found {outliers:.0%} of the image compressing very differently "
                    "from the rest. This pattern appears when text or numbers are pasted or retouched."
                ),
            )
        ]
    return []
