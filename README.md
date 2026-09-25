# SANAD — سند

**SANAD** ("something you can rely on") is a mobile app that detects fake documents so
citizens don't fall for scams — a doctored bank-transfer receipt, a forged certificate, an
edited invoice. Point the camera at the document (or upload a PDF/PNG/JPEG) and SANAD tells
you whether it is genuine or fraudulent, explains why, and guides you to report fraud through
[TAMM](https://www.tamm.abudhabi).

```
Sanad/
├── mobile/    Expo (React Native) app — camera-first scanner UI
└── backend/   FastAPI service — document & metadata fraud analysis
```

## How it works

1. **Scan** — the app opens straight into the camera. Take one or more photos of the document,
   or swipe up / tap the attachment button to upload PDFs, PNGs or JPEGs from your library or files.
2. **Analyze** — the backend inspects the document's content *and* metadata: producer/creator and
   editing-software fingerprints (Photoshop, Canva, iLovePDF, Word …), EXIF/XMP edit history,
   incremental PDF updates, overlay/redaction annotations, broken digital signatures, JPEG
   error-level analysis, and content checks (Emirates ID checksum, IBAN checksum, future dates).
3. **Verdict**
   - **Fraud** → red screen: *"Alert: This is a fraud document!"*, a risk score and the list of
     findings, then a **How to proceed** button with step-by-step instructions to report through
     TAMM / Abu Dhabi Police.
   - **Authentic** → green screen: *"This is a real document, you can proceed"* and **Done**.

> "Authentic" means no signs of editing or tampering were detected. SANAD does not yet query an
> official issuer registry, so treat the green result as a strong signal, not a guarantee.

## Running locally

### Backend

```bash
cd backend
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements-dev.txt
uvicorn app.main:app --reload --port 8000   # http://localhost:8000/docs
pytest -q && ruff check .
```

### Mobile

```bash
cd mobile
npm install
cp .env.example .env     # set EXPO_PUBLIC_API_URL to your machine's LAN IP for a physical device
npx expo start           # press i / a for a simulator, or scan the QR code with Expo Go
npx expo lint && npx tsc --noEmit
```

The Android emulator reaches the host backend via `http://10.0.2.2:8000` automatically.
