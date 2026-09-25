"""Generate sample documents for trying SANAD: `python3 samples/generate.py`.

Writes a `real/` set that should pass and a `fake/` set that should be flagged, in PDF, JPEG and
PNG form. Only Pillow is required (already a backend dependency).
"""

from __future__ import annotations

import io
import sys
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

OUT = Path(__file__).resolve().parent
FONT_DIR = Path("/usr/share/fonts/truetype/dejavu")

# --- Shared receipt content --------------------------------------------------

REAL_TRANSFER = [
    ("EMIRATES GULF BANK", "title"),
    ("Funds Transfer Confirmation", "subtitle"),
    ("", ""),
    ("Reference No: FT24061512345678", ""),
    ("Date: 15/06/2024 14:32", ""),
    ("Status: Successful", ""),
    ("", ""),
    ("From account: AE07 0331 2345 6789 0123 456", ""),
    ("To beneficiary: Al Noor Electronics Trading LLC", ""),
    ("Beneficiary IBAN: AE46 0090 0000 0012 3456 789", ""),
    ("", ""),
    ("Amount: AED 2,450.00", "amount"),
    ("Charges: AED 0.00", ""),
    ("Purpose: Purchase of laptop - invoice INV-2024-0311", ""),
    ("", ""),
    ("This is a system-generated confirmation and does not require a signature.", "small"),
]

REAL_INVOICE = [
    ("TAX INVOICE", "title"),
    ("Al Noor Electronics Trading LLC", "subtitle"),
    ("", ""),
    ("Trade Name: Al Noor Electronics Trading LLC", ""),
    ("Trade Licence No: CN-1234567", ""),
    ("TRN: 100234567890003", ""),
    ("Address: Shop 12, Al Wahda Mall, Abu Dhabi, UAE", ""),
    ("", ""),
    ("Invoice No: INV-2024-0311", ""),
    ("Invoice Date: 15/06/2024", ""),
    ("Customer: Walk-in customer", ""),
    ("", ""),
    ("1 x Laptop 14in 16GB/512GB            AED 2,333.33", ""),
    ("VAT 5%                                 AED   116.67", ""),
    ("Total                                  AED 2,450.00", "amount"),
    ("", ""),
    ("Payment method: Bank transfer FT24061512345678", "small"),
]

FAKE_TRANSFER = [
    ("EMIRATES GULF BANK", "title"),
    ("Funds Transfer Confirmation", "subtitle"),
    ("", ""),
    ("Reference No: FT24061512345678", ""),
    ("Date: 15/06/2024 14:32", ""),
    ("Status: Successful", ""),
    ("", ""),
    ("From account: AE07 0331 2345 6789 0123 456", ""),
    ("To beneficiary: Al Noor Electronics Trading LLC", ""),
    ("Beneficiary IBAN: AE46 0090 0000 0012 3456 789", ""),
    ("", ""),
    ("Amount: AED 24,500.00", "amount"),
    ("Charges: AED 0.00", ""),
    ("Purpose: Purchase of laptop - invoice INV-2024-0311", ""),
    ("", ""),
    ("This is a system-generated confirmation and does not require a signature.", "small"),
]

FAKE_INVOICE = [
    ("TAX INVOICE", "title"),
    ("Golden Star Mobile Phones Trading", "subtitle"),
    ("", ""),
    ("Trade Name: Golden Star Mobile Phones Trading", ""),
    ("Trade Licence No: 99887766", ""),
    ("TRN: 123456789012", ""),
    ("Address: Deira, Dubai, UAE", ""),
    ("", ""),
    ("Invoice No: 0001", ""),
    ("Invoice Date: 30/11/2027", ""),
    ("Customer: Cash", ""),
    ("", ""),
    ("1 x Smartphone 256GB                   AED 4,761.90", ""),
    ("VAT 5%                                 AED   238.10", ""),
    ("Total                                  AED 5,000.00", "amount"),
    ("", ""),
    ("Bank: AE12 0345 0000 0000 1111 222", ""),
    ("Emirates ID of seller: 784-1990-1234567-1", "small"),
]


# --- Minimal PDF writer -----------------------------------------------------


def _pdf_str(value: str) -> str:
    value = value.encode("latin-1", "replace").decode("latin-1")
    return "(" + value.replace("\\", "\\\\").replace("(", "\\(").replace(")", "\\)") + ")"


def make_pdf(
    lines: list[tuple[str, str]],
    *,
    producer: str,
    creator: str | None = None,
    creation_date: str,
    mod_date: str | None = None,
) -> bytes:
    ops = ["0.04 0.18 0.32 rg"]
    y = 740
    for text, style in lines:
        if style == "title":
            font, size = "/F2", 20
        elif style == "subtitle":
            font, size = "/F1", 13
        elif style == "amount":
            font, size = "/F2", 14
        elif style == "small":
            font, size = "/F1", 8
        else:
            font, size = "/F3", 11
        if text:
            ops.append(f"BT {font} {size} Tf 50 {y} Td {_pdf_str(text)} Tj ET")
        y -= 22 if style != "small" else 16
    ops.append("0.78 0.6 0.35 RG 2 w 50 765 m 562 765 l S")
    content = "\n".join(ops)

    info = [f"/Producer {_pdf_str(producer)}", f"/CreationDate ({creation_date})"]
    if creator:
        info.append(f"/Creator {_pdf_str(creator)}")
    if mod_date:
        info.append(f"/ModDate ({mod_date})")

    objects = [
        "<< /Type /Catalog /Pages 2 0 R >>",
        "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
        "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R "
        "/Resources << /Font << /F1 5 0 R /F2 6 0 R /F3 7 0 R >> >> >>",
        f"<< /Length {len(content)} >>\nstream\n{content}\nendstream",
        "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
        "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>",
        "<< /Type /Font /Subtype /Type1 /BaseFont /Courier >>",
        "<< " + " ".join(info) + " >>",
    ]
    out = io.BytesIO()
    out.write(b"%PDF-1.4\n")
    offsets = []
    for i, obj in enumerate(objects, start=1):
        offsets.append(out.tell())
        out.write(f"{i} 0 obj\n{obj}\nendobj\n".encode("latin-1"))
    xref = out.tell()
    out.write(f"xref\n0 {len(objects) + 1}\n".encode())
    out.write(b"0000000000 65535 f \n")
    for off in offsets:
        out.write(f"{off:010d} 00000 n \n".encode())
    out.write(
        f"trailer\n<< /Size {len(objects) + 1} /Root 1 0 R /Info 8 0 R >>\n"
        f"startxref\n{xref}\n%%EOF\n".encode()
    )
    return out.getvalue()


def add_overlay_revision(pdf: bytes, overlay_text: str) -> bytes:
    """Append a second revision that pastes a FreeText box over the page (how amounts get 'edited')."""
    prev_xref = int(pdf.rsplit(b"startxref\n", 1)[1].split(b"\n", 1)[0])
    out = io.BytesIO(pdf)
    out.seek(0, io.SEEK_END)
    new_objects = {
        9: f"<< /Type /Annot /Subtype /FreeText /Rect [50 470 400 500] /Contents {_pdf_str(overlay_text)} "
        "/DA (/Helv 14 Tf 0 g) /C [1 1 1] >>",
        3: "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R "
        "/Resources << /Font << /F1 5 0 R /F2 6 0 R /F3 7 0 R >> >> /Annots [9 0 R] >>",
    }
    offsets: dict[int, int] = {}
    for num, obj in new_objects.items():
        offsets[num] = out.tell()
        out.write(f"{num} 0 obj\n{obj}\nendobj\n".encode("latin-1"))
    xref = out.tell()
    out.write(b"xref\n")
    for num in sorted(offsets):
        out.write(f"{num} 1\n{offsets[num]:010d} 00000 n \n".encode())
    out.write(
        f"trailer\n<< /Size 10 /Root 1 0 R /Info 8 0 R /Prev {prev_xref} >>\nstartxref\n{xref}\n%%EOF\n".encode()
    )
    return out.getvalue()


# --- Rendered receipt images ------------------------------------------------


def _font(name: str, size: int) -> ImageFont.FreeTypeFont:
    return ImageFont.truetype(str(FONT_DIR / name), size)


def render_receipt(lines: list[tuple[str, str]], *, phone_photo: bool) -> Image.Image:
    w, h = (1080, 1440) if phone_photo else (900, 1200)
    paper = Image.new("RGB", (w, h), (252, 252, 250))
    draw = ImageDraw.Draw(paper)
    draw.rectangle([60, 60, w - 60, 66], fill=(200, 152, 90))
    y = 100
    for text, style in lines:
        if style == "title":
            font, color = _font("DejaVuSans-Bold.ttf", 44), (10, 46, 82)
        elif style == "subtitle":
            font, color = _font("DejaVuSans.ttf", 28), (60, 70, 90)
        elif style == "amount":
            font, color = _font("DejaVuSans-Bold.ttf", 34), (10, 46, 82)
        elif style == "small":
            font, color = _font("DejaVuSans.ttf", 18), (120, 120, 120)
        else:
            font, color = _font("DejaVuSansMono.ttf", 24), (30, 30, 30)
        if text:
            draw.text((70, y), text, font=font, fill=color)
        y += 52 if style != "small" else 36
    if not phone_photo:
        return paper
    # Mimic a phone photo: slight tint, vignette-free soft noise, tiny rotation.
    photo = paper.rotate(1.2, resample=Image.BICUBIC, expand=False, fillcolor=(90, 84, 78))
    noise = Image.effect_noise((w, h), 6).convert("RGB")
    return Image.blend(photo, noise, 0.06)


def jpeg_bytes(
    img: Image.Image,
    *,
    make: str,
    model: str,
    original: str,
    modified: str | None = None,
    software: str | None = None,
    xmp: bytes | None = None,
    quality: int = 90,
) -> bytes:
    exif = Image.Exif()
    exif[0x010F] = make
    exif[0x0110] = model
    exif[0x0132] = modified or original
    if software:
        exif[0x0131] = software
    ifd = exif.get_ifd(0x8769)
    ifd[0x9003] = original
    ifd[0x9004] = original
    buf = io.BytesIO()
    kwargs: dict = {"exif": exif.tobytes(), "quality": quality}
    if xmp:
        kwargs["xmp"] = xmp
    img.save(buf, "JPEG", **kwargs)
    return buf.getvalue()


def png_bytes(img: Image.Image, *, software: str | None = None) -> bytes:
    from PIL import PngImagePlugin

    info = PngImagePlugin.PngInfo()
    if software:
        info.add_text("Software", software)
    buf = io.BytesIO()
    img.save(buf, "PNG", pnginfo=info)
    return buf.getvalue()


PHOTOSHOP_XMP = b"""<?xpacket begin="" id="W5M0MpCehiHzreSzNTczkc9d"?>
<x:xmpmeta xmlns:x="adobe:ns:meta/"><rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#">
<rdf:Description rdf:about="" xmlns:xmp="http://ns.adobe.com/xap/1.0/" xmlns:xmpMM="http://ns.adobe.com/xap/1.0/mm/"
 xmlns:stEvt="http://ns.adobe.com/xap/1.0/sType/ResourceEvent#" xmlns:photoshop="http://ns.adobe.com/photoshop/1.0/"
 xmp:CreatorTool="Adobe Photoshop 25.5 (Windows)" xmp:ModifyDate="2024-06-16T21:04:11+04:00">
<xmpMM:History><rdf:Seq>
<rdf:li stEvt:action="created" stEvt:softwareAgent="Adobe Photoshop 25.5 (Windows)"/>
<rdf:li stEvt:action="saved" stEvt:softwareAgent="Adobe Photoshop 25.5 (Windows)" stEvt:changed="/"/>
</rdf:Seq></xmpMM:History></rdf:Description></rdf:RDF></x:xmpmeta>
<?xpacket end="w"?>"""


def splice_amount(img: Image.Image) -> Image.Image:
    """Paste a heavily re-compressed copy of the amount line back in, like a retouched number."""
    box = (60, 660, 700, 720)
    region = img.crop(box)
    buf = io.BytesIO()
    region.save(buf, "JPEG", quality=35)
    buf.seek(0)
    patched = img.copy()
    patched.paste(Image.open(buf).convert("RGB"), box)
    return patched


def main() -> None:
    real = OUT / "real"
    fake = OUT / "fake"
    real.mkdir(exist_ok=True)
    fake.mkdir(exist_ok=True)

    # --- Real ---------------------------------------------------------------
    (real / "bank-transfer-receipt.pdf").write_bytes(
        make_pdf(
            REAL_TRANSFER,
            producer="CoreBanking Statement Engine 4.2",
            creation_date="D:20240615143205+04'00'",
        )
    )
    (real / "tax-invoice.pdf").write_bytes(
        make_pdf(
            REAL_INVOICE,
            producer="SAP Crystal Reports 14.3",
            creator="Al Noor POS",
            creation_date="D:20240615143900+04'00'",
            mod_date="D:20240615143900+04'00'",
        )
    )
    (real / "receipt-photo.jpg").write_bytes(
        jpeg_bytes(
            render_receipt(REAL_TRANSFER, phone_photo=True),
            make="samsung",
            model="SM-S918B",
            original="2024:06:15 14:35:10",
        )
    )
    (real / "receipt-screenshot.png").write_bytes(png_bytes(render_receipt(REAL_TRANSFER, phone_photo=False)))

    # --- Fake ---------------------------------------------------------------
    edited = make_pdf(
        FAKE_TRANSFER,
        producer="CoreBanking Statement Engine 4.2",
        creator="Adobe Acrobat Pro DC 23.6",
        creation_date="D:20240615143205+04'00'",
        mod_date="D:20240618221740+04'00'",
    )
    (fake / "edited-bank-receipt.pdf").write_bytes(add_overlay_revision(edited, "Amount: AED 24,500.00"))

    (fake / "typed-tax-invoice.pdf").write_bytes(
        make_pdf(
            FAKE_INVOICE,
            producer="Microsoft® Word for Microsoft 365",
            creator="Microsoft® Word for Microsoft 365",
            creation_date="D:20240620091200+04'00'",
        )
    )

    photo = render_receipt(FAKE_TRANSFER, phone_photo=True)
    (fake / "photoshopped-receipt.jpg").write_bytes(
        jpeg_bytes(
            splice_amount(photo),
            make="samsung",
            model="SM-S918B",
            original="2024:06:15 14:35:10",
            modified="2024:06:16 21:04:11",
            software="Adobe Photoshop 25.5 (Windows)",
            xmp=PHOTOSHOP_XMP,
        )
    )
    (fake / "tampered-timestamps-receipt.jpg").write_bytes(
        jpeg_bytes(
            render_receipt(FAKE_TRANSFER, phone_photo=True),
            make="Apple",
            model="iPhone 15",
            original="2024:06:15 14:35:10",
            modified="2024:06:10 08:00:00",
            software="Snapseed 2.21",
        )
    )
    (fake / "gimp-edited-screenshot.png").write_bytes(
        png_bytes(render_receipt(FAKE_TRANSFER, phone_photo=False), software="GIMP 2.10.36")
    )

    for path in sorted(OUT.rglob("*.*")):
        if path.suffix in {".pdf", ".jpg", ".png"}:
            print(f"{path.relative_to(OUT)}  {path.stat().st_size / 1024:.0f} KB")


if __name__ == "__main__":
    sys.exit(main())
