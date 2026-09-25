# Sample documents

Fictional documents for trying SANAD. None of them is a real bank, business or government
document. Regenerate with `python3 samples/generate.py`.

| File | Expected result | Why |
| --- | --- | --- |
| `real/bank-transfer-receipt.pdf` | Authentic (green) | System-generated PDF, valid IBANs, no edits |
| `real/tax-invoice.pdf` | Authentic (green) | Valid 15-digit TRN, licence no. and trade name are extracted for the official lookup |
| `real/receipt-photo.jpg` | Authentic (green) | Phone photo with consistent EXIF, no editor traces |
| `real/receipt-screenshot.png` | Authentic (green) | Plain screenshot, no software tag |
| `fake/edited-bank-receipt.pdf` | Fraud (red) | Saved by Acrobat Pro, modified 3 days after issue, second revision pastes a new amount over the page |
| `fake/typed-tax-invoice.pdf` | Fraud (red) | Typed in Word, invalid TRN, invalid IBAN, invalid Emirates ID, future invoice date |
| `fake/photoshopped-receipt.jpg` | Fraud (red) | Photoshop in EXIF + XMP edit history, modified after capture, amount changed to AED 24,500 |
| `fake/tampered-timestamps-receipt.jpg` | Fraud (red) | Edited with Snapseed, modification time earlier than capture time |
| `fake/gimp-edited-screenshot.png` | Fraud (red) | PNG carries a GIMP software tag |
