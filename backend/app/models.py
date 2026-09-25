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


class DocumentReport(BaseModel):
    filename: str
    kind: str
    mime_type: str
    size_bytes: int
    metadata: dict[str, str] = Field(default_factory=dict)
    findings: list[Finding] = Field(default_factory=list)

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
