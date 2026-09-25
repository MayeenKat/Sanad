from __future__ import annotations

from datetime import UTC, datetime

from fastapi.testclient import TestClient

from app.analysis.common import check_text_content
from app.analysis.engine import aggregate, analyze_document
from app.analysis.licence import check_business_identifiers, extract_business_identifiers
from app.main import app
from tests.fixtures import add_incremental_update, make_jpeg, make_pdf, make_png

NOW = datetime(2026, 9, 25, tzinfo=UTC)


def codes(report) -> set[str]:
    return {f.code for f in report.findings}


# --- images ----------------------------------------------------------------


def test_clean_camera_photo_is_authentic():
    report = analyze_document(make_jpeg(), "photo.jpg", "image/jpeg")
    result = aggregate([report])
    assert result.verdict == "authentic"
    assert report.metadata["camera"] == "Apple iPhone 14"
    assert "editing_software" not in codes(report)


def test_photoshop_software_tag_is_fraud():
    data = make_jpeg(software="Adobe Photoshop 25.0 (Macintosh)", modified="2024:03:05 18:00:00")
    report = analyze_document(data, "receipt.jpg", "image/jpeg")
    result = aggregate([report])
    assert result.verdict == "fraud"
    assert {"editing_software", "modified_after_creation"} <= codes(report)
    assert result.findings[0].code == "editing_software"


def test_phone_camera_software_tag_is_not_flagged():
    data = make_jpeg(software="iOS 17.4")
    report = analyze_document(data, "receipt.jpg", "image/jpeg")
    assert "editing_software" not in codes(report)
    assert "office_software" not in codes(report)


def test_xmp_history_is_flagged():
    xmp = (
        b'<x:xmpmeta xmlns:x="adobe:ns:meta/"><rdf:RDF><rdf:Description '
        b'xmp:CreatorTool="Canva" xmpMM:History="yes"/></rdf:RDF></x:xmpmeta>'
    )
    report = analyze_document(make_jpeg(xmp=xmp), "receipt.jpg", "image/jpeg")
    assert {"editing_software", "xmp_edit_history"} <= codes(report)


def test_png_software_chunk_is_flagged():
    report = analyze_document(make_png(software="GIMP 2.10"), "receipt.png", "image/png")
    assert "editing_software" in codes(report)


def test_plain_png_is_authentic():
    report = analyze_document(make_png(), "receipt.png", "image/png")
    assert aggregate([report]).verdict == "authentic"


# --- pdf -------------------------------------------------------------------


def test_bank_generated_pdf_is_authentic():
    pdf = make_pdf("Transfer AED 1,500.00\nIBAN AE070331234567890123456\nDate 01/03/2024")
    report = analyze_document(pdf, "receipt.pdf", "application/pdf")
    result = aggregate([report])
    assert result.verdict == "authentic", result.findings
    assert report.metadata["producer"].startswith("CoreBanking")
    assert report.metadata["digitally_signed"] == "no"


def test_pdf_edited_with_editor_is_fraud():
    pdf = make_pdf(producer="iLovePDF", mod_date="D:20240310120000+04'00'")
    report = analyze_document(pdf, "receipt.pdf", "application/pdf")
    assert {"editing_software", "modified_after_creation"} <= codes(report)
    assert aggregate([report]).verdict == "fraud"


def test_incremental_update_with_overlay_is_fraud():
    pdf = add_incremental_update(make_pdf(), annotation=True)
    report = analyze_document(pdf, "receipt.pdf", "application/pdf")
    assert {"incremental_updates", "overlay_annotations"} <= codes(report)
    assert report.metadata["revisions"] == "2"
    assert aggregate([report]).verdict == "fraud"


def test_word_generated_pdf_is_only_medium():
    pdf = make_pdf(producer="Microsoft® Word for Microsoft 365")
    report = analyze_document(pdf, "letter.pdf", "application/pdf")
    assert "office_software" in codes(report)
    assert aggregate([report]).verdict == "authentic"


def test_invalid_iban_in_pdf_text():
    pdf = make_pdf("Beneficiary IBAN AE070331234567890123457")
    report = analyze_document(pdf, "receipt.pdf", "application/pdf")
    assert "invalid_iban" in codes(report)


def test_spaced_iban_groups_are_joined():
    pdf = make_pdf("From account: AE07 0331 2345 6789 0123 456\nTo: AE46 0090 0000 0012 3456 789")
    report = analyze_document(pdf, "receipt.pdf", "application/pdf")
    assert not any(code.startswith("invalid_iban") for code in codes(report))

    pdf = make_pdf("Beneficiary IBAN: AE12 0345 0000 0000 1111 222")
    report = analyze_document(pdf, "receipt.pdf", "application/pdf")
    assert "invalid_iban" in codes(report)


def test_corrupt_pdf():
    report = analyze_document(b"%PDF-1.7 garbage", "x.pdf", "application/pdf")
    assert "unreadable_pdf" in codes(report)


# --- content checks --------------------------------------------------------


def test_emirates_id_checksum():
    assert not check_text_content("ID 784-1990-1234567-1", now=NOW) == []
    bad = check_text_content("ID 784-1990-1234567-1", now=NOW)
    assert bad[0].code == "invalid_emirates_id"
    # 784-1990-1234567-? -> compute the valid check digit and ensure it passes.
    for check in range(10):
        candidate = f"784-1990-1234567-{check}"
        if not check_text_content(candidate, now=NOW):
            break
    else:
        raise AssertionError("no valid check digit found")


def test_future_date_in_text():
    findings = check_text_content("Paid on 31/12/2030", now=NOW)
    assert findings[0].code == "future_date_in_text"
    assert check_text_content("Paid on 01/03/2024", now=NOW) == []


# --- business identifiers ------------------------------------------------


def test_extracts_licence_and_trn():
    text = "Trade Name: Al Noor Trading LLC\nTrade Licence No: CN-1234567\nTRN: 100 2345 6789 0003"
    ids = extract_business_identifiers(text)
    assert ids.licence_numbers == ["CN-1234567"]
    assert ids.tax_registration_numbers == ["100234567890003"]
    assert ids.trade_name == "Al Noor Trading LLC"
    assert check_business_identifiers(ids) == []


def test_invalid_trn_flagged():
    ids = extract_business_identifiers("TRN 123456789")
    findings = check_business_identifiers(ids)
    assert findings and findings[0].code == "invalid_trn"


def test_pdf_report_carries_business_identifiers():
    pdf = make_pdf("Tax Invoice\nLicense No. 987654\nTRN: 100987654321003")
    result = aggregate([analyze_document(pdf, "invoice.pdf", "application/pdf")])
    assert result.business.licence_numbers == ["987654"]
    assert result.business.tax_registration_numbers == ["100987654321003"]


# --- api -------------------------------------------------------------------


def test_analyze_endpoint_multi_file():
    client = TestClient(app)
    files = [
        ("files", ("page1.jpg", make_jpeg(), "image/jpeg")),
        ("files", ("page2.jpg", make_jpeg(software="Adobe Photoshop 25.0"), "image/jpeg")),
    ]
    resp = client.post("/analyze", files=files)
    assert resp.status_code == 200
    body = resp.json()
    assert body["verdict"] == "fraud"
    assert len(body["documents"]) == 2
    assert body["findings"][0]["severity"] == "high"


def test_analyze_endpoint_rejects_unknown_format():
    client = TestClient(app)
    resp = client.post("/analyze", files=[("files", ("notes.txt", b"hello", "text/plain"))])
    assert resp.status_code == 415
    assert "notes.txt" in resp.json()["detail"]


def test_health():
    assert TestClient(app).get("/health").json() == {"status": "ok"}
