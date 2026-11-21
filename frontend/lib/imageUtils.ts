/**
 * Client-side EXIF focal length extraction (~1 ms) + 1024px long-edge JPEG resize.
 * Extracts EXIF BEFORE drawing to canvas (since canvas strips EXIF headers).
 */

export interface ProcessedRoomImage {
  file: File;
  previewUrl: string;
  originalWidth: number;
  originalHeight: number;
  resizedWidth: number;
  resizedHeight: number;
  exifFocalMm: number | null;
  processingMs: number;
}

/**
 * Lightweight zero-dependency JPEG EXIF reader targeting FocalLengthIn35mmFilm (0xA405)
 * with fallback to FocalLength (0x920A).
 */
export async function extractExifFocalLengthMm(file: File): Promise<number | null> {
  try {
    const slice = file.slice(0, 131072); // First 128 KB is enough for APP1 EXIF header
    const buffer = await slice.arrayBuffer();
    const view = new DataView(buffer);

    if (view.byteLength < 12 || view.getUint16(0, false) !== 0xffd8) {
      return null; // Not a JPEG
    }

    let offset = 2;
    while (offset + 4 < view.byteLength) {
      const marker = view.getUint16(offset, false);
      offset += 2;
      if (marker === 0xffe1) {
        // APP1 segment
        const length = view.getUint16(offset, false);
        const exifHeaderOffset = offset + 2;
        if (
          exifHeaderOffset + 6 <= view.byteLength &&
          view.getUint32(exifHeaderOffset, false) === 0x45786966 // "Exif"
        ) {
          const tiffStart = exifHeaderOffset + 6;
          return parseTiffForFocalLength(view, tiffStart);
        }
        offset += length;
      } else if ((marker & 0xff00) !== 0xff00) {
        break;
      } else {
        const size = view.getUint16(offset, false);
        offset += size;
      }
    }
    return null;
  } catch {
    return null;
  }
}

function parseTiffForFocalLength(view: DataView, tiffStart: number): number | null {
  if (tiffStart + 8 > view.byteLength) return null;
  const byteOrder = view.getUint16(tiffStart, false);
  const littleEndian = byteOrder === 0x4949; // "II"

  const firstIfdOffset = view.getUint32(tiffStart + 4, littleEndian);
  const ifd0Start = tiffStart + firstIfdOffset;
  if (ifd0Start + 2 > view.byteLength) return null;

  const entries = view.getUint16(ifd0Start, littleEndian);
  let exifIfdOffset: number | null = null;

  for (let i = 0; i < entries; i++) {
    const entryOffset = ifd0Start + 2 + i * 12;
    if (entryOffset + 12 > view.byteLength) break;
    const tag = view.getUint16(entryOffset, littleEndian);
    if (tag === 0x8769) {
      // ExifIFDPointer
      exifIfdOffset = view.getUint32(entryOffset + 8, littleEndian);
      break;
    }
  }

  if (exifIfdOffset === null) return null;
  const exifStart = tiffStart + exifIfdOffset;
  if (exifStart + 2 > view.byteLength) return null;

  const exifEntries = view.getUint16(exifStart, littleEndian);
  let focalLength35: number | null = null;
  let focalLengthRaw: number | null = null;

  for (let i = 0; i < exifEntries; i++) {
    const entryOffset = exifStart + 2 + i * 12;
    if (entryOffset + 12 > view.byteLength) break;
    const tag = view.getUint16(entryOffset, littleEndian);

    if (tag === 0xa405) {
      // FocalLengthIn35mmFilm (SHORT)
      focalLength35 = view.getUint16(entryOffset + 8, littleEndian);
    } else if (tag === 0x920a) {
      // FocalLength (RATIONAL)
      const valOffset = tiffStart + view.getUint32(entryOffset + 8, littleEndian);
      if (valOffset + 8 <= view.byteLength) {
        const num = view.getUint32(valOffset, littleEndian);
        const den = view.getUint32(valOffset + 4, littleEndian);
        if (den > 0) focalLengthRaw = Math.round((num / den) * 10) / 10;
      }
    }
  }

  return focalLength35 || focalLengthRaw || null;
}

/**
 * Resize image to max 1024px on the long edge as JPEG (cuts 3-5s off Nano Banana latency).
 */
export async function preprocessRoomImage(
  file: File,
  maxLongEdge = 1024
): Promise<ProcessedRoomImage> {
  const t0 = performance.now();
  const exifFocalMm = await extractExifFocalLengthMm(file);

  const objectUrl = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = reject;
      image.src = objectUrl;
    });

    const { naturalWidth: origW, naturalHeight: origH } = img;
    const longEdge = Math.max(origW, origH);
    const scale = longEdge > maxLongEdge ? maxLongEdge / longEdge : 1;
    const targetW = Math.round(origW * scale);
    const targetH = Math.round(origH * scale);

    const canvas = document.createElement("canvas");
    canvas.width = targetW;
    canvas.height = targetH;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas 2D context unavailable");

    ctx.drawImage(img, 0, 0, targetW, targetH);

    const blob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        (b) => (b ? resolve(b) : reject(new Error("JPEG encode failed"))),
        "image/jpeg",
        0.88
      );
    });

    const resizedFile = new File([blob], file.name.replace(/\.\w+$/, ".jpg"), {
      type: "image/jpeg",
    });
    const previewUrl = URL.createObjectURL(blob);

    return {
      file: resizedFile,
      previewUrl,
      originalWidth: origW,
      originalHeight: origH,
      resizedWidth: targetW,
      resizedHeight: targetH,
      exifFocalMm,
      processingMs: Math.max(1, Math.round(performance.now() - t0)),
    };
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

/** Auto-extracts budget in USD from spoken/typed prompt (e.g. "under $450" -> 450). */
export function extractBudgetFromPrompt(prompt: string, fallback = 450): number {
  const dollarMatch = prompt.match(/\$\s?(\d{2,5}(?:,\d{3})*)/);
  if (dollarMatch) {
    return parseInt(dollarMatch[1].replace(/,/g, ""), 10);
  }
  const underMatch = prompt.match(/(?:under|below|max|budget(?:\s+of)?)\s+(\d{2,5})/i);
  if (underMatch) {
    return parseInt(underMatch[1], 10);
  }
  return fallback;
}
