from __future__ import annotations

import io

from PIL import Image


def _pdf_string(value: str) -> str:
    return "(" + value.replace("\\", "\\\\").replace("(", "\\(").replace(")", "\\)") + ")"


def make_pdf(
    text: str = "Transaction receipt",
    *,
    producer: str = "CoreBanking Statement Engine 4.2",
    creator: str | None = None,
    creation_date: str = "D:20240301101500+04'00'",
    mod_date: str | None = None,
    annotations: str = "",
) -> bytes:
    lines = text.split("\n")
    content = (
        "BT /F1 12 Tf 50 750 Td 14 TL " + " ".join(f"{_pdf_string(line)} Tj T*" for line in lines) + " ET"
    )
    info_entries = [f"/Producer {_pdf_string(producer)}", f"/CreationDate ({creation_date})"]
    if creator:
        info_entries.append(f"/Creator {_pdf_string(creator)}")
    if mod_date:
        info_entries.append(f"/ModDate ({mod_date})")
    annots = f" /Annots [{annotations}]" if annotations else ""
    objects = [
        "<< /Type /Catalog /Pages 2 0 R >>",
        "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
        f"<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R "
        f"/Resources << /Font << /F1 5 0 R >> >>{annots} >>",
        f"<< /Length {len(content)} >>\nstream\n{content}\nendstream",
        "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
        "<< " + " ".join(info_entries) + " >>",
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
        f"trailer\n<< /Size {len(objects) + 1} /Root 1 0 R /Info 6 0 R >>\nstartxref\n{xref}\n%%EOF\n".encode()
    )
    return out.getvalue()


def add_incremental_update(pdf: bytes, *, annotation: bool = False) -> bytes:
    """Append a second revision, optionally overlaying a FreeText annotation on page 3 0 R."""
    prev_xref = int(pdf.rsplit(b"startxref\n", 1)[1].split(b"\n", 1)[0])
    out = io.BytesIO(pdf)
    out.seek(0, io.SEEK_END)
    new_objects: dict[int, str] = {}
    if annotation:
        new_objects[7] = (
            "<< /Type /Annot /Subtype /FreeText /Rect [50 700 300 760] /Contents (AED 25,000.00) >>"
        )
        new_objects[3] = (
            "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R "
            "/Resources << /Font << /F1 5 0 R >> >> /Annots [7 0 R] >>"
        )
    else:
        new_objects[6] = (
            "<< /Producer (CoreBanking Statement Engine 4.2) /CreationDate (D:20240301101500+04'00') >>"
        )
    offsets: dict[int, int] = {}
    for num, obj in new_objects.items():
        offsets[num] = out.tell()
        out.write(f"{num} 0 obj\n{obj}\nendobj\n".encode("latin-1"))
    xref = out.tell()
    out.write(b"xref\n")
    for num in sorted(offsets):
        out.write(f"{num} 1\n{offsets[num]:010d} 00000 n \n".encode())
    size = max(8, max(offsets) + 1)
    out.write(
        f"trailer\n<< /Size {size} /Root 1 0 R /Info 6 0 R /Prev {prev_xref} >>\nstartxref\n{xref}\n%%EOF\n".encode()
    )
    return out.getvalue()


def make_jpeg(
    *,
    software: str | None = None,
    original: str | None = "2024:03:01 10:15:00",
    modified: str | None = None,
    make: str | None = "Apple",
    model: str | None = "iPhone 14",
    size: tuple[int, int] = (640, 480),
    xmp: bytes | None = None,
) -> bytes:
    img = Image.new("RGB", size, (245, 245, 240))
    px = img.load()
    for x in range(0, size[0], 7):
        for y in range(0, size[1], 11):
            px[x, y] = (40, 40, 40)
    exif = Image.Exif()
    if software:
        exif[0x0131] = software
    if make:
        exif[0x010F] = make
    if model:
        exif[0x0110] = model
    if modified:
        exif[0x0132] = modified
    if original:
        ifd = exif.get_ifd(0x8769)
        ifd[0x9003] = original
        ifd[0x9004] = original
    buf = io.BytesIO()
    kwargs = {"exif": exif.tobytes()}
    if xmp:
        kwargs["xmp"] = xmp
    img.save(buf, "JPEG", quality=92, **kwargs)
    return buf.getvalue()


def make_png(*, software: str | None = None) -> bytes:
    from PIL import PngImagePlugin

    img = Image.new("RGB", (300, 200), (255, 255, 255))
    info = PngImagePlugin.PngInfo()
    if software:
        info.add_text("Software", software)
    buf = io.BytesIO()
    img.save(buf, "PNG", pnginfo=info)
    return buf.getvalue()
