import {
  decodePDFRawStream,
  PDFArray,
  PDFDict,
  PDFDocument,
  PDFHexString,
  PDFName,
  PDFNumber,
  PDFObject,
  PDFRawStream,
  PDFStream,
  PDFString,
} from "pdf-lib";

import type { DocumentReport, Finding } from "../types";
import {
  checkBusinessIdentifiers,
  checkDates,
  checkTextContent,
  countBytes,
  editingSoftwareMatch,
  emptyBusiness,
  extractBusinessIdentifiers,
  extractXmp,
  finding,
  formatUtc,
  indexOfBytes,
  latin1,
  parseDatetime,
  softwareFindings,
} from "./common";

const XMP_TOOL =
  /(?:xmp:CreatorTool|pdf:Producer|stEvt:softwareAgent)\s*=\s*"([^"]+)"|<(?:xmp:CreatorTool|pdf:Producer|stEvt:softwareAgent)>([^<]+)</gi;

export async function analyzePdf(data: Uint8Array, filename: string, mimeType: string): Promise<DocumentReport> {
  const report: DocumentReport = {
    filename,
    kind: "pdf",
    mime_type: mimeType,
    size_bytes: data.length,
    metadata: {},
    findings: [],
    business: emptyBusiness(),
  };

  let doc: PDFDocument;
  try {
    doc = await PDFDocument.load(data, {
      ignoreEncryption: true,
      updateMetadata: false,
      throwOnInvalidObject: false,
    });
  } catch {
    report.findings.push(
      finding(
        "unreadable_pdf",
        "high",
        "PDF could not be parsed",
        "The file is not a well-formed PDF. Corrupted structure is common in hand-edited files.",
      ),
    );
    return report;
  }

  const info = infoDict(doc);
  const producer = textEntry(doc, info, "Producer");
  const creator = textEntry(doc, info, "Creator");
  const author = textEntry(doc, info, "Author");
  const title = textEntry(doc, info, "Title");
  const created = parseDatetime(textEntry(doc, info, "CreationDate"));
  const modified = parseDatetime(textEntry(doc, info, "ModDate"));

  const pages = safe(() => doc.getPages(), []);
  report.metadata.pages = String(pages.length);
  for (const [key, value] of [
    ["producer", producer],
    ["creator", creator],
    ["author", author],
    ["title", title],
  ] as const) {
    if (value) report.metadata[key] = value;
  }
  if (created) report.metadata.created = formatUtc(created);
  if (modified) report.metadata.modified = formatUtc(modified);

  let flagged = false;
  for (const [source, value] of [
    ["producer", producer],
    ["creator", creator],
  ] as const) {
    const found = softwareFindings(`PDF ${source}`, value);
    if (found.length) {
      report.findings.push(...found);
      flagged = true;
      break;
    }
  }

  report.findings.push(...checkDates(created, modified));

  const xmp = extractXmp(data);
  if (xmp && !flagged) {
    for (const m of xmp.matchAll(XMP_TOOL)) {
      const tool = m[1] ?? m[2];
      if (editingSoftwareMatch(tool)) {
        report.findings.push(...softwareFindings("XMP", tool));
        break;
      }
    }
  }

  const eofCount = countBytes(data, "%%EOF");
  const hasPrev = indexOfBytes(data, "/Prev") !== -1;
  if (eofCount > 1 && hasPrev) {
    report.metadata.revisions = String(eofCount);
    report.findings.push(
      finding(
        "incremental_updates",
        eofCount > 2 ? "high" : "medium",
        "File was saved again after it was issued",
        `The PDF contains ${eofCount} revisions layered on top of the original. Each revision is a later edit; genuine receipts and certificates have one.`,
      ),
    );
  }

  const signed = hasSignature(doc);
  report.metadata.digitally_signed = signed ? "yes" : "no";
  if (signed && eofCount > 2) {
    report.findings.push(
      finding(
        "modified_after_signing",
        "critical",
        "Document changed after it was digitally signed",
        "Edits were saved on top of a signed version, which invalidates the issuer's signature.",
      ),
    );
  }

  report.findings.push(...annotationFindings(doc, pages));

  let text = "";
  for (const page of pages.slice(0, 10)) {
    text += safe(() => extractPageText(doc, page.node), "") + "\n";
  }
  report.findings.push(...checkTextContent(text));
  report.business = extractBusinessIdentifiers(text);
  report.findings.push(...checkBusinessIdentifiers(report.business));

  if (!text.trim() && pages.length) {
    report.findings.push(
      finding(
        "image_only_pdf",
        "low",
        "PDF contains only images, no text layer",
        "System-generated receipts contain real text. A scanned or screenshot PDF cannot be verified from its content.",
      ),
    );
  }

  return report;
}

function safe<T>(fn: () => T, fallback: T): T {
  try {
    return fn();
  } catch {
    return fallback;
  }
}

function infoDict(doc: PDFDocument): PDFDict | undefined {
  const ref = doc.context.trailerInfo.Info;
  if (!ref) return undefined;
  return safe(() => doc.context.lookupMaybe(ref, PDFDict), undefined);
}

function textEntry(doc: PDFDocument, dict: PDFDict | undefined, key: string): string | null {
  if (!dict) return null;
  const value = safe(() => doc.context.lookupMaybe(dict.get(PDFName.of(key)), PDFString, PDFHexString), undefined);
  if (!value) return null;
  const text = safe(() => value.decodeText(), value.asString()).trim();
  return text || null;
}

function hasSignature(doc: PDFDocument): boolean {
  return safe(() => {
    const acro = doc.catalog.AcroForm();
    if (!acro) return false;
    const sigFlags = acro.lookupMaybe(PDFName.of("SigFlags"), PDFNumber);
    if (sigFlags && sigFlags.asNumber()) return true;
    const fields = acro.lookupMaybe(PDFName.of("Fields"), PDFArray);
    if (!fields) return false;
    for (let i = 0; i < fields.size(); i++) {
      const field = doc.context.lookupMaybe(fields.get(i), PDFDict);
      if (field?.lookupMaybe(PDFName.of("FT"), PDFName)?.asString() === "/Sig") return true;
    }
    return false;
  }, false);
}

function annotationFindings(doc: PDFDocument, pages: ReturnType<PDFDocument["getPages"]>): Finding[] {
  let overlays = 0;
  let redactions = 0;
  for (const page of pages) {
    safe(() => {
      const annots = page.node.Annots();
      if (!annots) return;
      for (let i = 0; i < annots.size(); i++) {
        const annot = doc.context.lookupMaybe(annots.get(i), PDFDict);
        const subtype = annot?.lookupMaybe(PDFName.of("Subtype"), PDFName)?.asString();
        if (subtype === "/FreeText" || subtype === "/Stamp" || subtype === "/Square") overlays++;
        else if (subtype === "/Redact") redactions++;
      }
    }, undefined);
  }
  const findings: Finding[] = [];
  if (overlays) {
    findings.push(
      finding(
        "overlay_annotations",
        "high",
        "Text or shapes were placed over the original content",
        `${overlays} annotation(s) of type text-box/stamp/rectangle sit on top of the page. This is the usual way amounts, names or dates are covered and replaced.`,
      ),
    );
  }
  if (redactions) {
    findings.push(
      finding(
        "redaction_annotations",
        "high",
        "Redaction marks found",
        `${redactions} redaction annotation(s) hide part of the original document.`,
      ),
    );
  }
  return findings;
}

// --- Text extraction -------------------------------------------------------

type PageNode = ReturnType<PDFDocument["getPages"]>[number]["node"];
type Glyphs = Map<number, string>;
interface FontInfo {
  twoByte: boolean;
  toUnicode: Glyphs | null;
}

function streamBytes(doc: PDFDocument, obj: PDFObject | undefined): Uint8Array | null {
  const stream = doc.context.lookupMaybe(obj, PDFStream);
  if (!stream) return null;
  if (stream instanceof PDFRawStream) return decodePDFRawStream(stream).decode();
  return stream.getContents();
}

function extractPageText(doc: PDFDocument, node: PageNode): string {
  const contents = node.Contents();
  const chunks: Uint8Array[] = [];
  if (contents instanceof PDFArray) {
    for (let i = 0; i < contents.size(); i++) {
      const bytes = streamBytes(doc, contents.get(i));
      if (bytes) chunks.push(bytes);
    }
  } else if (contents) {
    const bytes = streamBytes(doc, contents);
    if (bytes) chunks.push(bytes);
  }
  if (!chunks.length) return "";
  const content = chunks.map((c) => latin1(c)).join("\n");
  const fonts = loadFonts(doc, node.Resources());
  return runTextOperators(content, fonts);
}

function loadFonts(doc: PDFDocument, resources: PDFDict | undefined): Map<string, FontInfo> {
  const fonts = new Map<string, FontInfo>();
  const fontDict = safe(() => resources?.lookupMaybe(PDFName.of("Font"), PDFDict), undefined);
  if (!fontDict) return fonts;
  for (const [name, ref] of fontDict.entries()) {
    safe(() => {
      const font = doc.context.lookupMaybe(ref, PDFDict);
      if (!font) return;
      const subtype = font.lookupMaybe(PDFName.of("Subtype"), PDFName)?.asString();
      const toUnicodeBytes = streamBytes(doc, font.get(PDFName.of("ToUnicode")));
      const toUnicode = toUnicodeBytes ? parseToUnicode(latin1(toUnicodeBytes)) : null;
      fonts.set(name.asString(), { twoByte: subtype === "/Type0", toUnicode });
    }, undefined);
  }
  return fonts;
}

function parseToUnicode(cmap: string): Glyphs {
  const glyphs: Glyphs = new Map();
  const hexToStr = (hex: string) => {
    let out = "";
    for (let i = 0; i + 3 < hex.length; i += 4) out += String.fromCharCode(parseInt(hex.slice(i, i + 4), 16));
    return out;
  };
  for (const block of cmap.matchAll(/beginbfchar([\s\S]*?)endbfchar/g)) {
    for (const m of block[1].matchAll(/<([0-9a-fA-F]+)>\s*<([0-9a-fA-F]*)>/g)) {
      glyphs.set(parseInt(m[1], 16), hexToStr(m[2]));
    }
  }
  for (const block of cmap.matchAll(/beginbfrange([\s\S]*?)endbfrange/g)) {
    for (const m of block[1].matchAll(/<([0-9a-fA-F]+)>\s*<([0-9a-fA-F]+)>\s*(?:<([0-9a-fA-F]*)>|\[([^\]]*)\])/g)) {
      const lo = parseInt(m[1], 16);
      const hi = parseInt(m[2], 16);
      if (hi - lo > 65535) continue;
      if (m[3] !== undefined) {
        const base = m[3].length >= 4 ? parseInt(m[3].slice(-4), 16) : parseInt(m[3] || "0", 16);
        const prefix = m[3].length > 4 ? hexToStr(m[3].slice(0, -4)) : "";
        for (let code = lo; code <= hi; code++) glyphs.set(code, prefix + String.fromCharCode(base + (code - lo)));
      } else if (m[4] !== undefined) {
        const items = Array.from(m[4].matchAll(/<([0-9a-fA-F]*)>/g)).map((x) => hexToStr(x[1]));
        items.forEach((s, i) => glyphs.set(lo + i, s));
      }
    }
  }
  return glyphs;
}

const ESCAPES: Record<string, string> = {
  n: "\n",
  r: "\r",
  t: "\t",
  b: "\b",
  f: "\f",
  "(": "(",
  ")": ")",
  "\\": "\\",
};

/** Minimal content-stream interpreter: tracks the current font and emits text shown by Tj/TJ/'/" */
function runTextOperators(content: string, fonts: Map<string, FontInfo>): string {
  let out = "";
  let font: FontInfo | undefined;
  const operands: string[] = [];
  let i = 0;
  const n = content.length;

  const decode = (raw: string, hex: boolean): string => {
    if (!font?.twoByte && !font?.toUnicode) return raw;
    let s = "";
    const width = font.twoByte ? 2 : 1;
    for (let k = 0; k + width <= raw.length; k += width) {
      const code = width === 2 ? (raw.charCodeAt(k) << 8) | raw.charCodeAt(k + 1) : raw.charCodeAt(k);
      const mapped = font.toUnicode?.get(code);
      s += mapped ?? (width === 2 ? "" : raw[k]);
    }
    return s || (hex ? "" : raw);
  };

  while (i < n) {
    const ch = content[i];
    if (/\s/.test(ch)) {
      i++;
      continue;
    }
    if (ch === "%") {
      while (i < n && content[i] !== "\n" && content[i] !== "\r") i++;
      continue;
    }
    if (ch === "(") {
      let depth = 1;
      let s = "";
      i++;
      while (i < n && depth > 0) {
        const c = content[i];
        if (c === "\\") {
          const next = content[i + 1];
          const oct = /^[0-7]{1,3}/.exec(content.slice(i + 1, i + 4));
          if (oct) {
            s += String.fromCharCode(parseInt(oct[0], 8));
            i += 1 + oct[0].length;
          } else if (next === "\n" || next === "\r") {
            i += 2;
          } else {
            s += ESCAPES[next] ?? next;
            i += 2;
          }
          continue;
        }
        if (c === "(") depth++;
        else if (c === ")") {
          depth--;
          if (depth === 0) break;
        }
        s += c;
        i++;
      }
      i++;
      operands.push(`(${decode(s, false)}`);
      continue;
    }
    if (ch === "<" && content[i + 1] !== "<") {
      const end = content.indexOf(">", i);
      const hex = content.slice(i + 1, end === -1 ? n : end).replace(/\s+/g, "");
      let s = "";
      for (let k = 0; k < hex.length; k += 2)
        s += String.fromCharCode(parseInt(hex.slice(k, k + 2).padEnd(2, "0"), 16));
      i = end === -1 ? n : end + 1;
      operands.push(`(${decode(s, true)}`);
      continue;
    }
    if (ch === "[") {
      const end = matchingBracket(content, i);
      const inner = content.slice(i + 1, end);
      const strings: string[] = [];
      let m: RegExpExecArray | null;
      const re = /\(((?:\\.|[^\\)])*)\)|<([0-9a-fA-F\s]*)>|(-?\d+\.?\d*)/g;
      while ((m = re.exec(inner))) {
        if (m[1] !== undefined) strings.push(decode(unescapeLiteral(m[1]), false));
        else if (m[2] !== undefined) {
          const hex = m[2].replace(/\s+/g, "");
          let s = "";
          for (let k = 0; k < hex.length; k += 2)
            s += String.fromCharCode(parseInt(hex.slice(k, k + 2).padEnd(2, "0"), 16));
          strings.push(decode(s, true));
        } else if (Number(m[3]) < -200) strings.push(" ");
      }
      operands.push(`[${strings.join("")}`);
      i = end + 1;
      continue;
    }
    if (ch === "<" && content[i + 1] === "<") {
      const end = content.indexOf(">>", i);
      i = end === -1 ? n : end + 2;
      operands.length = 0;
      continue;
    }
    let j = i;
    while (j < n && !/[\s()<>[\]{}/%]/.test(content[j])) j++;
    if (ch === "/") {
      j = i + 1;
      while (j < n && !/[\s()<>[\]{}/%]/.test(content[j])) j++;
      operands.push(content.slice(i, j));
      i = j;
      continue;
    }
    const token = content.slice(i, j);
    i = j === i ? i + 1 : j;
    if (/^[-+.\d]/.test(token)) {
      operands.push(token);
      continue;
    }
    switch (token) {
      case "Tf": {
        const name = operands.find((o) => o.startsWith("/"));
        font = name ? fonts.get(name) : undefined;
        break;
      }
      case "Tj":
      case "'":
      case '"': {
        const s = operands.filter((o) => o.startsWith("(")).pop();
        if (s) out += (token === "Tj" ? "" : "\n") + s.slice(1);
        break;
      }
      case "TJ": {
        const s = operands.filter((o) => o.startsWith("[")).pop();
        if (s) out += s.slice(1);
        break;
      }
      case "T*":
      case "Td":
      case "TD":
      case "Tm":
      case "ET":
        if (!out.endsWith("\n")) out += "\n";
        break;
    }
    operands.length = 0;
  }
  return out;
}

function unescapeLiteral(s: string): string {
  return s.replace(/\\([0-7]{1,3}|.)/g, (_, esc: string) =>
    /^[0-7]/.test(esc) ? String.fromCharCode(parseInt(esc, 8)) : (ESCAPES[esc] ?? esc),
  );
}

function matchingBracket(content: string, start: number): number {
  let depth = 0;
  let inString = 0;
  for (let i = start; i < content.length; i++) {
    const c = content[i];
    if (inString) {
      if (c === "\\") i++;
      else if (c === "(") inString++;
      else if (c === ")") inString--;
      continue;
    }
    if (c === "(") inString = 1;
    else if (c === "[") depth++;
    else if (c === "]") {
      depth--;
      if (depth === 0) return i;
    }
  }
  return content.length;
}
