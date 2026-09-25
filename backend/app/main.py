from __future__ import annotations

from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware

from app.analysis.engine import aggregate, analyze_document
from app.models import AnalysisResult

MAX_FILE_BYTES = 25 * 1024 * 1024
MAX_FILES = 10

app = FastAPI(
    title="SANAD Document Verification API",
    description="Detects forged receipts and government documents from content and metadata.",
    version="0.1.0",
)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.post("/analyze", response_model=AnalysisResult)
async def analyze(files: list[UploadFile] = File(...)) -> AnalysisResult:
    if not files:
        raise HTTPException(status_code=400, detail="Upload at least one file.")
    if len(files) > MAX_FILES:
        raise HTTPException(status_code=400, detail=f"Upload at most {MAX_FILES} files.")

    reports = []
    for upload in files:
        data = await upload.read()
        if not data:
            raise HTTPException(status_code=400, detail=f"'{upload.filename}' is empty.")
        if len(data) > MAX_FILE_BYTES:
            raise HTTPException(status_code=413, detail=f"'{upload.filename}' exceeds 25 MB.")
        reports.append(analyze_document(data, upload.filename or "document", upload.content_type))
    return aggregate(reports)
