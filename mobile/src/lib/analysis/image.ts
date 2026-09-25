import type { DocumentReport, Finding } from "../types";
import {
  checkDates,
  emptyBusiness,
  extractXmp,
  finding,
  formatUtc,
  indexOfBytes,
  latin1,
  parseDatetime,
  softwareFindings,
  utf8,
} from "./common";

const XMP_SOFTWARE =
  /(?:xmp:CreatorTool|stEvt:softwareAgent|xmp:ModifyDate)\s*=\s*"([^"]+)"|<(?:xmp:CreatorTool|stEvt:softwareAgent)>([^<]+)</gi;
const XMP_HISTORY = /xmpMM:History|stEvt:action\s*=\s*"(?:saved|edited|converted)"/i;
const PHOTOSHOP_MARKERS = ["Photoshop 3.0", "8BIM", "Adobe Photoshop", "photoshop:"];

interface ImageInfo {
  format: string;
  width: number;
  height: number;
  exif: Record<string, string>;
  textChunks: Record<string, string>;
  xmp: string;
}

export async function analyzeImage(data: Uint8Array, filename: string, mimeType: string): Promise<DocumentReport> {
  const report: DocumentReport = {
    filename,
    kind: "image",
    mime_type: mimeType,
    size_bytes: data.length,
    metadata: {},
    findings: [],
    business: emptyBusiness(),
  };

  const info = decodeImage(data);
  if (!info) {
    report.findings.push(
      finding(
        "unreadable_image",
        "high",
        "Image could not be decoded",
        "The file is not a valid image, or it has been corrupted.",
      ),
    );
    return report;
  }

  report.metadata.format = info.format;
  if (info.width && info.height) report.metadata.dimensions = `${info.width}x${info.height}`;

  const software = info.exif.Software;
  if (software) report.metadata.software = software;
  const camera = [info.exif.Make, info.exif.Model].filter(Boolean).join(" ");
  if (camera) report.metadata.camera = camera;
  const created = parseDatetime(info.exif.DateTimeOriginal ?? info.exif.DateTimeDigitized);
  const modified = parseDatetime(info.exif.DateTime);
  if (created) report.metadata.captured = formatUtc(created);
  if (modified) report.metadata.modified = formatUtc(modified);

  report.findings.push(...softwareFindings("image", software));
  report.findings.push(...checkDates(created, modified));

  if (info.xmp) report.findings.push(...xmpFindings(info.xmp, Boolean(software)));

  if (info.format === "PNG") {
    const pngSoftware = info.textChunks.Software ?? info.textChunks.Comment;
    if (pngSoftware) {
      report.metadata.software ??= pngSoftware;
      if (!software) report.findings.push(...softwareFindings("image", pngSoftware));
    }
  }

  if (
    PHOTOSHOP_MARKERS.some((marker) => indexOfBytes(data, marker) !== -1) &&
    !report.findings.some((f) => f.code === "editing_software")
  ) {
    report.findings.push(
      finding(
        "photoshop_segment",
        "high",
        "Adobe Photoshop data embedded in the file",
        "The image contains Photoshop resource blocks, which are only written when a file is saved from Photoshop.",
      ),
    );
  }

  return report;
}

function xmpFindings(xmp: string, alreadyFlagged: boolean): Finding[] {
  const findings: Finding[] = [];
  if (!alreadyFlagged) {
    const tools = new Set(Array.from(xmp.matchAll(XMP_SOFTWARE), (m) => m[1] ?? m[2]).filter(Boolean));
    for (const tool of tools) {
      const found = softwareFindings("XMP", tool);
      if (found.length) {
        findings.push(...found);
        break;
      }
    }
  }
  if (XMP_HISTORY.test(xmp)) {
    findings.push(
      finding(
        "xmp_edit_history",
        "medium",
        "Embedded edit history found",
        "The image carries an XMP editing history, meaning it was opened and saved by an editor after it was produced.",
      ),
    );
  }
  return findings;
}

// --- Container parsing -----------------------------------------------------

function decodeImage(data: Uint8Array): ImageInfo | null {
  if (data.length < 12) return null;
  if (data[0] === 0xff && data[1] === 0xd8 && data[2] === 0xff) return parseJpeg(data);
  if (data[0] === 0x89 && data[1] === 0x50 && data[2] === 0x4e && data[3] === 0x47) return parsePng(data);
  const riff = latin1(data, 0, 4) === "RIFF" && latin1(data, 8, 12) === "WEBP";
  const ftyp = latin1(data, 4, 8) === "ftyp";
  if (riff || ftyp) {
    return {
      format: riff ? "WEBP" : "HEIF",
      width: 0,
      height: 0,
      exif: {},
      textChunks: {},
      xmp: extractXmp(data),
    };
  }
  return null;
}

function parseJpeg(data: Uint8Array): ImageInfo | null {
  const info: ImageInfo = {
    format: "JPEG",
    width: 0,
    height: 0,
    exif: {},
    textChunks: {},
    xmp: "",
  };
  const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
  let pos = 2;
  let sawFrame = false;
  while (pos + 4 <= data.length) {
    if (data[pos] !== 0xff) return sawFrame ? info : null;
    const marker = data[pos + 1];
    if (marker === 0xd8 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) {
      pos += 2;
      continue;
    }
    if (marker === 0xd9 || marker === 0xda) break;
    const length = view.getUint16(pos + 2);
    const segStart = pos + 4;
    const segEnd = Math.min(pos + 2 + length, data.length);
    if (marker === 0xe1 && latin1(data, segStart, segStart + 6) === "Exif\0\0") {
      Object.assign(info.exif, parseTiff(data.subarray(segStart + 6, segEnd)));
    } else if (marker === 0xe1 && latin1(data, segStart, segStart + 28) === "http://ns.adobe.com/xap/1.0/") {
      info.xmp = utf8(data.subarray(segStart + 29, segEnd));
    } else if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
      info.height = view.getUint16(segStart + 1);
      info.width = view.getUint16(segStart + 3);
      sawFrame = true;
    }
    pos = segEnd;
  }
  if (!info.xmp) info.xmp = extractXmp(data);
  return sawFrame || info.width ? info : null;
}

const TIFF_TAGS: Record<number, string> = {
  0x010f: "Make",
  0x0110: "Model",
  0x0131: "Software",
  0x0132: "DateTime",
  0x9003: "DateTimeOriginal",
  0x9004: "DateTimeDigitized",
  0x010e: "ImageDescription",
  0x013b: "Artist",
  0x8298: "Copyright",
};
const EXIF_IFD_POINTER = 0x8769;

function parseTiff(tiff: Uint8Array): Record<string, string> {
  const result: Record<string, string> = {};
  if (tiff.length < 8) return result;
  const view = new DataView(tiff.buffer, tiff.byteOffset, tiff.byteLength);
  const little = tiff[0] === 0x49 && tiff[1] === 0x49;
  if (!little && !(tiff[0] === 0x4d && tiff[1] === 0x4d)) return result;
  const u16 = (o: number) => view.getUint16(o, little);
  const u32 = (o: number) => view.getUint32(o, little);

  const readIfd = (offset: number, depth: number) => {
    if (depth > 2 || offset + 2 > tiff.length) return;
    const count = u16(offset);
    for (let i = 0; i < count; i++) {
      const entry = offset + 2 + i * 12;
      if (entry + 12 > tiff.length) return;
      const tag = u16(entry);
      const type = u16(entry + 2);
      const num = u32(entry + 4);
      if (tag === EXIF_IFD_POINTER) {
        readIfd(u32(entry + 8), depth + 1);
        continue;
      }
      const name = TIFF_TAGS[tag];
      if (!name || type !== 2) continue;
      const valueOffset = num <= 4 ? entry + 8 : u32(entry + 8);
      if (valueOffset + num > tiff.length) continue;
      const text = latin1(tiff, valueOffset, valueOffset + num)
        .replace(/[\0 ]+$/g, "")
        .trim();
      if (text) result[name] = text;
    }
  };
  readIfd(u32(4), 0);
  return result;
}

function parsePng(data: Uint8Array): ImageInfo | null {
  const info: ImageInfo = {
    format: "PNG",
    width: 0,
    height: 0,
    exif: {},
    textChunks: {},
    xmp: "",
  };
  const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
  let pos = 8;
  while (pos + 8 <= data.length) {
    const length = view.getUint32(pos);
    const type = latin1(data, pos + 4, pos + 8);
    const start = pos + 8;
    const end = Math.min(start + length, data.length);
    if (type === "IHDR") {
      info.width = view.getUint32(start);
      info.height = view.getUint32(start + 4);
    } else if (type === "tEXt" || type === "iTXt") {
      const chunk = data.subarray(start, end);
      const nul = chunk.indexOf(0);
      if (nul !== -1) {
        const key = latin1(chunk, 0, nul);
        let value: string;
        if (type === "tEXt") {
          value = latin1(chunk, nul + 1);
        } else {
          // iTXt: compression flag, method, language tag\0, translated keyword\0, text
          let p = nul + 3;
          p = chunk.indexOf(0, p) + 1;
          p = chunk.indexOf(0, p) + 1;
          value = chunk[nul + 1] === 0 ? utf8(chunk.subarray(p)) : "";
        }
        if (key === "XML:com.adobe.xmp") info.xmp = value;
        else if (value) info.textChunks[key] = value;
      }
    } else if (type === "eXIf") {
      Object.assign(info.exif, parseTiff(data.subarray(start, end)));
    } else if (type === "IEND") {
      break;
    }
    pos = end + 4;
  }
  if (!info.xmp) info.xmp = extractXmp(data);
  return info.width ? info : null;
}
