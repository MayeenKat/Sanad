from __future__ import annotations

import re

from app.models import BusinessIdentifiers, Finding, Severity

_LICENCE_NO = re.compile(
    r"(?:trade|commercial|business|economic|professional)?\s*licen[cs]e\s*(?:no|number|#|№)?\s*[:.\-]?\s*"
    r"([A-Z]{0,4}[-/ ]?\d{4,10}(?:[-/]\d{1,6})?)",
    re.IGNORECASE,
)
_TRN = re.compile(
    r"\b(?:TRN|tax\s+registration\s+(?:no|number)|VAT\s+(?:no|number|reg))\.?\s*[:#\-]?\s*(\d[\d ]{7,18}\d)",
    re.IGNORECASE,
)
_TRADE_NAME = re.compile(
    r"(?:trade|company|business|establishment)\s+name\s*[:\-]\s*([^\n]{3,80})",
    re.IGNORECASE,
)


def extract_business_identifiers(text: str) -> BusinessIdentifiers:
    ids = BusinessIdentifiers()
    if not text:
        return ids

    seen: set[str] = set()
    for m in _LICENCE_NO.finditer(text):
        value = re.sub(r"\s+", "", m.group(1)).upper()
        if value not in seen:
            seen.add(value)
            ids.licence_numbers.append(value)

    for m in _TRN.finditer(text):
        digits = re.sub(r"\D", "", m.group(1))
        if digits not in ids.tax_registration_numbers:
            ids.tax_registration_numbers.append(digits)

    m = _TRADE_NAME.search(text)
    if m:
        ids.trade_name = m.group(1).strip().rstrip(".,;")

    return ids


def check_business_identifiers(ids: BusinessIdentifiers) -> list[Finding]:
    findings: list[Finding] = []
    for trn in ids.tax_registration_numbers:
        if len(trn) != 15 or not trn.startswith("100"):
            findings.append(
                Finding(
                    code="invalid_trn",
                    severity=Severity.HIGH,
                    title="Tax Registration Number has an invalid format",
                    detail=(
                        f"The TRN '{trn}' is not a valid UAE Federal Tax Authority number. "
                        "Genuine UAE tax invoices carry a 15-digit TRN starting with 100."
                    ),
                )
            )
    return findings
