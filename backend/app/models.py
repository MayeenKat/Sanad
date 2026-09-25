from __future__ import annotations

from enum import StrEnum

from pydantic import BaseModel, Field


class Severity(StrEnum):
    CRITICAL = "critical"
    HIGH = "high"
    MEDIUM = "medium"
    LOW = "low"
    INFO = "info"


SEVERITY_WEIGHTS: dict[Severity, int] = {
    Severity.CRITICAL: 60,
    Severity.HIGH: 40,
    Severity.MEDIUM: 15,
    Severity.LOW: 5,
    Severity.INFO: 0,
}

FRAUD_THRESHOLD = 40


class Finding(BaseModel):
    code: str
    severity: Severity
    title: str
    detail: str


class BusinessIdentifiers(BaseModel):
    """Issuer identifiers found in the document text, for lookup in official UAE registries."""

    licence_numbers: list[str] = Field(default_factory=list)
    tax_registration_numbers: list[str] = Field(default_factory=list)
    trade_name: str | None = None

    def is_empty(self) -> bool:
        return not (self.licence_numbers or self.tax_registration_numbers or self.trade_name)


class DocumentReport(BaseModel):
    filename: str
    kind: str
    mime_type: str
    size_bytes: int
    metadata: dict[str, str] = Field(default_factory=dict)
    findings: list[Finding] = Field(default_factory=list)
    business: BusinessIdentifiers = Field(default_factory=BusinessIdentifiers)

    @property
    def score(self) -> int:
        return sum(SEVERITY_WEIGHTS[f.severity] for f in self.findings)


class Verdict(StrEnum):
    FRAUD = "fraud"
    AUTHENTIC = "authentic"


class AnalysisResult(BaseModel):
    verdict: Verdict
    risk_score: int
    summary: str
    documents: list[DocumentReport]
    findings: list[Finding]
    business: BusinessIdentifiers = Field(default_factory=BusinessIdentifiers)
