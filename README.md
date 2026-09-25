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
