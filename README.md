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
4. **Check the issuer's UAE licence** — both result screens show a *Check the issuer's UAE licence*
   card. The backend extracts the trade name, trade-licence number and TRN printed in the document
   (and flags TRNs that don't match the 15-digit FTA format); the card lets you copy each value and
   opens the official, UAE-wide **National Economic Registry** licence inquiry
   (`growth.gov.ae`, Ministry of Economy & Tourism — covers every emirate and free zone) as listed on
   [u.ae → Inquire about licences, names and activities](https://u.ae/en/information-and-services/business/important-digital-services/inquire-about-licences-names-and-activities).
   TRNs link to the Federal Tax Authority's TRN Verification box on tax.gov.ae.

> "Authentic" means no signs of editing or tampering were detected. The official registries require
> UAE PASS sign-in and expose no public API, so SANAD hands you off to them rather than pretending to
> have verified the licence itself — treat the green result as a strong signal, not a guarantee.

## Design

White background with the palette taken from the SANAD logo: navy `#0A2E52` (primary actions,
viewfinder), gold `#C8985A` (accents, shutter ring), slate text `#0F2A47`. Red `#D6363C` and green
`#1F9D5A` are reserved for the fraud / authentic verdicts. Tokens live in `mobile/src/lib/theme.ts`;
icon, adaptive icon, splash and in-app logo assets in `mobile/assets/`.

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

### Android build (APK)

The app uses native modules (camera, pickers), so it needs a development/preview build rather than
Expo Go. With an Expo account:

```bash
cd mobile
npx eas-cli@latest login
npx eas-cli@latest build --platform android --profile preview   # produces an installable .apk
```

The `preview` profile in `mobile/eas.json` builds an APK (internal distribution); `production`
builds an AAB for the Play Store. Set `EXPO_PUBLIC_API_URL` in `eas.json` → `env` (or `.env`) to a
backend URL reachable from the phone.
