import type { CompiledGlyph, VirtualFontSpec } from './VirtualFont';

export type CharsetPresetId =
  | 'ascii'
  | 'en'
  | 'pl'
  | 'de'
  | 'cs'
  | 'fi'
  | 'latin-ext'
  | 'ui';

const ASCII_PRINTABLE = Array.from({ length: 95 }, (_, i) =>
  String.fromCharCode(0x20 + i)
).join('');

const LATIN_EXTENDED_BLOCK = Array.from({ length: 0x017f - 0x00a0 + 1 }, (_, i) =>
  String.fromCodePoint(0x00a0 + i)
).join('');

/**
 * Built-in character presets for national language support and engine UI icons.
 */
export const CHARSET_PRESETS: Readonly<Record<CharsetPresetId, string>> = {
  ascii: ASCII_PRINTABLE,
  en: ASCII_PRINTABLE,
  pl: 'ĄĆĘŁŃÓŚŹŻąćęłńóśźż',
  de: 'ÄÖÜẞäöüß',
  cs: 'ÁČĎÉĚÍŇÓŘŠŤÚŮÝŽáčďéěíňóřšťúůýž',
  fi: 'ÄÖÅŠŽäöåšž',
  'latin-ext': LATIN_EXTENDED_BLOCK,
  ui: '▲▼◀▶↑↓←→•×–—🎮',
};

const UI_FALLBACK_5X7: Readonly<Record<string, readonly string[]>> = {
  '▲': ['00100', '01110', '11111', '11111', '00000', '00000', '00000'],
  '▼': ['00000', '00000', '11111', '11111', '01110', '00100', '00000'],
  '◀': ['00010', '00110', '01110', '11110', '01110', '00110', '00010'],
  '▶': ['01000', '01100', '01110', '01111', '01110', '01100', '01000'],
  '↑': ['00100', '01110', '10101', '00100', '00100', '00100', '00100'],
  '↓': ['00100', '00100', '00100', '00100', '10101', '01110', '00100'],
  '←': ['00000', '00100', '01000', '11111', '01000', '00100', '00000'],
  '→': ['00000', '00100', '00010', '11111', '00010', '00100', '00000'],
  '•': ['00000', '00000', '01100', '01100', '00000', '00000', '00000'],
  '×': ['00000', '10001', '01010', '00100', '01010', '10001', '00000'],
  '–': ['00000', '00000', '00000', '11111', '00000', '00000', '00000'],
  '—': ['00000', '00000', '00000', '11111', '00000', '00000', '00000'],
  '🎮': ['01110', '11111', '10101', '11111', '11011', '10001', '00000'],
};

export interface FontCompileOptions {
  id: string;
  name: string;
  author?: string;
  license?: string;
  /** Locale/charset preset IDs to include (defaults to ['en', 'pl', 'de', 'cs', 'fi', 'ui']) */
  locales?: readonly string[];
  /** Additional custom characters to compile */
  extraChars?: string;
  /** Optional i18n locale dictionaries to scan for required characters */
  localeDictionaries?: ReadonlyArray<Record<string, string>>;
  /** Trim empty left/right columns per glyph for compact proportional spacing (default: true) */
  trimHorizontal?: boolean;
  /** Automatically synthesize missing national diacritics via Unicode NFD (default: true) */
  synthesizeMissingDiacritics?: boolean;
  /** Default pixel spacing between glyphs (default: 1) */
  defaultSpacing?: number;
}

export interface FontCoverageReport {
  readonly fontId: string;
  readonly covered: boolean;
  readonly totalUniqueChars: number;
  readonly missingChars: readonly string[];
}

function setBitCharAt(row: string, index: number, bit: '0' | '1'): string {
  if (index < 0 || index >= row.length) return row;
  return row.slice(0, index) + bit + row.slice(index + 1);
}

function padOrResizeHeight(rows: readonly string[], targetHeight: number): string[] {
  const w = rows[0]?.length ?? 5;
  const result = [...rows];
  while (result.length < targetHeight) {
    result.push('0'.repeat(w));
  }
  return result.slice(0, targetHeight);
}

function trimGlyphHorizontally(
  rows: readonly string[],
  isSpace: boolean,
  cellWidth: number
): CompiledGlyph {
  const height = rows.length;
  if (isSpace) {
    const spaceW = Math.max(3, Math.floor(cellWidth * 0.55));
    const emptyRow = '0'.repeat(spaceW);
    return {
      width: spaceW,
      height,
      rows: Array.from({ length: height }, () => emptyRow),
    };
  }

  const width = rows[0]?.length ?? 1;
  let minX = width;
  let maxX = -1;

  for (const row of rows) {
    for (let x = 0; x < row.length; x++) {
      if (row[x] === '1') {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
      }
    }
  }

  if (maxX < minX) {
    const fallbackW = Math.max(3, Math.floor(cellWidth * 0.55));
    const emptyRow = '0'.repeat(fallbackW);
    return {
      width: fallbackW,
      height,
      rows: Array.from({ length: height }, () => emptyRow),
    };
  }

  const trimmedW = maxX - minX + 1;
  return {
    width: trimmedW,
    height,
    rows: rows.map((r) => r.slice(minX, maxX + 1)),
  };
}

/**
 * Synthesizes a 1-bit pixel glyph for national characters (Polish, German, Czech, Finnish, etc.)
 * using Unicode NFD decomposition and stroke rules when the source font lacks the character.
 */
export function synthesizeNationalGlyph(
  ch: string,
  getBaseRows: (baseChar: string) => readonly string[] | null,
  cellWidth: number,
  cellHeight: number
): string[] | null {
  if (ch in UI_FALLBACK_5X7) {
    return padOrResizeHeight(UI_FALLBACK_5X7[ch], cellHeight);
  }

  if (ch === 'Ł' || ch === 'ł') {
    const base = getBaseRows(ch === 'Ł' ? 'L' : 'l');
    if (!base) return null;
    const rows = [...base];
    const w = rows[0]?.length ?? cellWidth;
    const midY = Math.max(1, Math.floor(cellHeight * 0.45));
    let stemX = Math.floor(w / 2);
    for (let x = 0; x < w; x++) {
      if (rows[midY]?.[x] === '1') {
        stemX = x;
        break;
      }
    }
    rows[midY] = setBitCharAt(rows[midY], Math.max(0, stemX - 1), '1');
    rows[Math.max(0, midY - 1)] = setBitCharAt(
      rows[Math.max(0, midY - 1)],
      Math.min(w - 1, stemX + 1),
      '1'
    );
    return rows;
  }

  if (ch === 'ß' || ch === 'ẞ') {
    const sBase = getBaseRows('S') ?? getBaseRows('s');
    const bBase = getBaseRows('B') ?? getBaseRows('b');
    const src = bBase ?? sBase;
    if (!src) return null;
    return [...src];
  }

  const nfd = ch.normalize('NFD');
  if (nfd.length < 2) {
    return null;
  }

  const baseChar = nfd[0];
  const markCode = nfd.codePointAt(1)!;
  const base = getBaseRows(baseChar);
  if (!base) {
    return null;
  }

  let rows = [...base];
  const h = rows.length;
  const w = rows[0]?.length ?? cellWidth;

  let topY = h;
  let botY = -1;
  let minX = w;
  let maxX = 0;

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (rows[y][x] === '1') {
        if (y < topY) topY = y;
        if (y > botY) botY = y;
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
      }
    }
  }

  if (botY < 0) {
    return null;
  }

  // Bottom diacritics: Ogonek (U+0328) or Cedilla (U+0327)
  if (markCode === 0x0328 || markCode === 0x0327) {
    if (botY >= h - 1 && topY > 0) {
      rows = [...rows.slice(1), '0'.repeat(w)];
      botY -= 1;
    }
    const targetY = Math.min(h - 1, botY + 1);
    let anchorX = Math.floor((minX + maxX) / 2);
    for (let x = w - 1; x >= 0; x--) {
      if (rows[botY][x] === '1') {
        anchorX = x;
        break;
      }
    }
    rows[targetY] = setBitCharAt(rows[targetY], Math.max(0, anchorX - 1), '1');
    rows[targetY] = setBitCharAt(rows[targetY], anchorX, '1');
    return rows;
  }

  // Top diacritics: Acute (0301), Grave (0300), Circumflex (0302), Caron (030C),
  // Diaeresis (0308), Ring (030A), Dot above (0307), Tilde (0303)
  const body = rows.slice(topY, botY + 1);
  const availBottom = Math.max(botY, h - 2);
  const maxBodyH = Math.max(3, availBottom - 2 + 1);

  while (body.length > maxBodyH && body.length > 3) {
    let removed = false;
    for (let i = 0; i < body.length - 1; i++) {
      if (body[i] === body[i + 1]) {
        body.splice(i, 1);
        removed = true;
        break;
      }
    }
    if (!removed) {
      body.splice(1, 1);
    }
  }

  rows = Array.from({ length: h }, () => '0'.repeat(w));
  const bodyStartY = Math.max(2, availBottom - body.length + 1);
  for (let i = 0; i < body.length && bodyStartY + i < h; i++) {
    rows[bodyStartY + i] = body[i];
  }

  const midX = Math.floor((minX + maxX) / 2);
  const leftX = Math.max(0, midX - 1);
  const rightX = Math.min(w - 1, midX + 1);

  switch (markCode) {
    case 0x0301: // Acute (´)
      rows[0] = setBitCharAt(rows[0], rightX, '1');
      rows[1] = setBitCharAt(rows[1], midX, '1');
      break;
    case 0x0300: // Grave (`)
      rows[0] = setBitCharAt(rows[0], leftX, '1');
      rows[1] = setBitCharAt(rows[1], midX, '1');
      break;
    case 0x030c: // Caron / Háček (ˇ)
      rows[0] = setBitCharAt(setBitCharAt(rows[0], leftX, '1'), rightX, '1');
      rows[1] = setBitCharAt(rows[1], midX, '1');
      break;
    case 0x0302: // Circumflex (^)
      rows[0] = setBitCharAt(rows[0], midX, '1');
      rows[1] = setBitCharAt(setBitCharAt(rows[1], leftX, '1'), rightX, '1');
      break;
    case 0x0308: // Diaeresis / Umlaut (¨)
      rows[0] = setBitCharAt(setBitCharAt(rows[0], leftX, '1'), rightX, '1');
      break;
    case 0x030a: // Ring above (˚)
      rows[0] = setBitCharAt(rows[0], midX, '1');
      rows[1] = setBitCharAt(setBitCharAt(rows[1], leftX, '1'), rightX, '1');
      break;
    case 0x0307: // Dot above (˙)
      rows[0] = setBitCharAt(rows[0], midX, '1');
      break;
    default:
      rows[0] = setBitCharAt(rows[0], midX, '1');
      break;
  }

  return rows;
}

/**
 * Resolves the complete unique list of characters to compile based on locale presets,
 * extra characters, and optional translation dictionaries.
 */
export function resolveTargetCharacters(options: FontCompileOptions): string[] {
  const locales = options.locales ?? ['en', 'pl', 'de', 'cs', 'fi', 'ui'];
  const charSet = new Set<string>(Array.from(CHARSET_PRESETS.ascii));

  for (const loc of locales) {
    const key = loc.toLowerCase() as CharsetPresetId;
    if (key in CHARSET_PRESETS) {
      for (const ch of CHARSET_PRESETS[key]) {
        charSet.add(ch);
      }
    }
  }

  for (const ch of CHARSET_PRESETS.ui) {
    charSet.add(ch);
  }

  if (options.extraChars) {
    for (const ch of options.extraChars) {
      charSet.add(ch);
    }
  }

  if (options.localeDictionaries) {
    for (const dict of options.localeDictionaries) {
      for (const val of Object.values(dict)) {
        for (const ch of val) {
          if (ch.codePointAt(0)! >= 0x20) {
            charSet.add(ch);
          }
        }
      }
    }
  }

  return Array.from(charSet);
}

/**
 * Compiles an SFNT OpenType/TrueType Bitmap font (.otb or .ttf with EBLC/EBDT or bloc/bdat tables)
 * into a deterministic `VirtualFontSpec` 1-bit pixel-mask definition.
 */
export function compileSfntBitmapFont(
  buffer: Uint8Array,
  options: FontCompileOptions
): VirtualFontSpec {
  const view = new DataView(buffer.buffer, buffer.byteOffset, buffer.byteLength);
  const numTables = view.getUint16(4, false);
  const tables: Record<string, { offset: number; length: number }> = {};

  for (let i = 0; i < numTables; i++) {
    const recOff = 12 + i * 16;
    const tag = String.fromCharCode(
      buffer[recOff],
      buffer[recOff + 1],
      buffer[recOff + 2],
      buffer[recOff + 3]
    );
    tables[tag] = {
      offset: view.getUint32(recOff + 8, false),
      length: view.getUint32(recOff + 12, false),
    };
  }

  const eblcMeta = tables.EBLC ?? tables.bloc;
  const ebdtMeta = tables.EBDT ?? tables.bdat;
  const cmapMeta = tables.cmap;

  if (!eblcMeta || !ebdtMeta || !cmapMeta) {
    throw new Error(
      `Font "${options.id}" is missing required SFNT bitmap tables (EBLC/EBDT/cmap).`
    );
  }

  const eblcOff = eblcMeta.offset;
  const ebdtOff = ebdtMeta.offset;
  const cmapOff = cmapMeta.offset;

  // Parse cmap Format 4 or Format 12
  const numCmapSubtables = view.getUint16(cmapOff + 2, false);
  let fmt4Off = 0;
  let fmt12Off = 0;

  for (let i = 0; i < numCmapSubtables; i++) {
    const subRel = view.getUint32(cmapOff + 4 + i * 8 + 4, false);
    const subAbs = cmapOff + subRel;
    const fmt = view.getUint16(subAbs, false);
    if (fmt === 12) {
      fmt12Off = subAbs;
    } else if (fmt === 4 && fmt4Off === 0) {
      fmt4Off = subAbs;
    }
  }

  function getGlyphId(codePoint: number): number {
    if (fmt12Off !== 0) {
      const numGroups = view.getUint32(fmt12Off + 12, false);
      for (let i = 0; i < numGroups; i++) {
        const gOff = fmt12Off + 16 + i * 12;
        const startCode = view.getUint32(gOff, false);
        const endCode = view.getUint32(gOff + 4, false);
        if (codePoint >= startCode && codePoint <= endCode) {
          const startGlyphId = view.getUint32(gOff + 8, false);
          return startGlyphId + (codePoint - startCode);
        }
      }
    }

    if (fmt4Off !== 0 && codePoint <= 0xffff) {
      const segCount = view.getUint16(fmt4Off + 6, false) / 2;
      const endCodesOff = fmt4Off + 14;
      const startCodesOff = endCodesOff + segCount * 2 + 2;
      const idDeltaOff = startCodesOff + segCount * 2;
      const idRangeOffsetOff = idDeltaOff + segCount * 2;

      for (let i = 0; i < segCount; i++) {
        const endCode = view.getUint16(endCodesOff + i * 2, false);
        const startCode = view.getUint16(startCodesOff + i * 2, false);
        if (codePoint >= startCode && codePoint <= endCode) {
          const idDelta = view.getInt16(idDeltaOff + i * 2, false);
          const idRangeOffset = view.getUint16(idRangeOffsetOff + i * 2, false);
          if (idRangeOffset === 0) {
            return (codePoint + idDelta) & 0xffff;
          }
          const glyphIdxOff =
            idRangeOffsetOff + i * 2 + idRangeOffset + (codePoint - startCode) * 2;
          const gid = view.getUint16(glyphIdxOff, false);
          return gid === 0 ? 0 : (gid + idDelta) & 0xffff;
        }
      }
    }

    return 0;
  }

  const indexSubTableArrayOffset = view.getUint32(eblcOff + 8, false);
  const numberOfIndexSubTables = view.getUint32(eblcOff + 16, false);

  let cellWidth = 8;
  let cellHeight = 8;

  for (let i = 0; i < numberOfIndexSubTables; i++) {
    const arrOff = eblcOff + indexSubTableArrayOffset + i * 8;
    const addOff = view.getUint32(arrOff + 4, false);
    const subOff = eblcOff + indexSubTableArrayOffset + addOff;
    const indexFormat = view.getUint16(subOff, false);
    if (indexFormat === 2) {
      const h = view.getUint8(subOff + 12);
      const w = view.getUint8(subOff + 13);
      if (w > 0 && h > 0) {
        cellWidth = w;
        cellHeight = h;
        break;
      }
    }
  }

  function extractRawGlyphRows(gid: number): string[] | null {
    if (gid <= 0) return null;

    for (let i = 0; i < numberOfIndexSubTables; i++) {
      const arrOff = eblcOff + indexSubTableArrayOffset + i * 8;
      const firstGlyph = view.getUint16(arrOff, false);
      const lastGlyph = view.getUint16(arrOff + 2, false);
      if (gid < firstGlyph || gid > lastGlyph) continue;

      const addOff = view.getUint32(arrOff + 4, false);
      const subOff = eblcOff + indexSubTableArrayOffset + addOff;
      const indexFormat = view.getUint16(subOff, false);
      const imageFormat = view.getUint16(subOff + 2, false);
      const imageDataOffset = view.getUint32(subOff + 4, false);

      if (indexFormat === 2 && imageFormat === 5) {
        const imageSize = view.getUint32(subOff + 8, false);
        const height = view.getUint8(subOff + 12);
        const width = view.getUint8(subOff + 13);
        const gOff = ebdtOff + imageDataOffset + (gid - firstGlyph) * imageSize;

        let bitIdx = 0;
        const rows: string[] = [];
        for (let y = 0; y < height; y++) {
          let row = '';
          for (let x = 0; x < width; x++) {
            const byte = buffer[gOff + (bitIdx >> 3)];
            const bit = (byte >> (7 - (bitIdx & 7))) & 1;
            row += bit ? '1' : '0';
            bitIdx++;
          }
          rows.push(row);
        }
        return rows;
      }

      if (
        (indexFormat === 1 || indexFormat === 3) &&
        (imageFormat === 7 || imageFormat === 6 || imageFormat === 2 || imageFormat === 1)
      ) {
        const stride = indexFormat === 1 ? 4 : 2;
        const idxOff = subOff + 8 + (gid - firstGlyph) * stride;
        const relOff =
          indexFormat === 1
            ? view.getUint32(idxOff, false)
            : view.getUint16(idxOff, false);
        const gOff = ebdtOff + imageDataOffset + relOff;
        const height = view.getUint8(gOff);
        const width = view.getUint8(gOff + 1);
        if (width === 0 || height === 0) {
          return Array.from({ length: cellHeight }, () => '0'.repeat(cellWidth));
        }
        const headerLen = imageFormat === 6 || imageFormat === 7 ? 8 : 5;
        const dataOff = gOff + headerLen;
        const bitPacked = imageFormat === 2 || imageFormat === 7;
        const rowBytes = Math.ceil(width / 8);

        let bitIdx = 0;
        const rows: string[] = [];
        for (let y = 0; y < height; y++) {
          let row = '';
          for (let x = 0; x < width; x++) {
            let bit = 0;
            if (bitPacked) {
              const byte = buffer[dataOff + (bitIdx >> 3)];
              bit = (byte >> (7 - (bitIdx & 7))) & 1;
              bitIdx++;
            } else {
              const byte = buffer[dataOff + y * rowBytes + (x >> 3)];
              bit = (byte >> (7 - (x & 7))) & 1;
            }
            row += bit ? '1' : '0';
          }
          rows.push(row);
        }
        return padOrResizeHeight(rows, cellHeight);
      }
    }

    return null;
  }

  function resolveRawCharRows(ch: string): string[] | null {
    const code = ch.codePointAt(0);
    if (code === undefined) return null;
    if (code === 0x20 || code === 0xa0) {
      return Array.from({ length: cellHeight }, () => '0'.repeat(cellWidth));
    }
    const gid = getGlyphId(code);
    return extractRawGlyphRows(gid);
  }

  const trimHorizontal = options.trimHorizontal ?? true;
  const synthesizeMissing = options.synthesizeMissingDiacritics ?? true;
  const targetChars = resolveTargetCharacters(options);
  const glyphs: Record<string, CompiledGlyph> = {};

  for (const ch of targetChars) {
    const isSpace = ch === ' ' || ch === '\u00a0';
    let rawRows = resolveRawCharRows(ch);

    if (!rawRows && synthesizeMissing) {
      rawRows = synthesizeNationalGlyph(
        ch,
        (baseChar) => resolveRawCharRows(baseChar),
        cellWidth,
        cellHeight
      );
    }

    if (!rawRows) {
      continue;
    }

    if (trimHorizontal) {
      glyphs[ch] = trimGlyphHorizontally(rawRows, isSpace, cellWidth);
    } else {
      glyphs[ch] = {
        width: rawRows[0]?.length ?? cellWidth,
        height: rawRows.length,
        rows: rawRows,
      };
    }
  }

  const fallbackGlyph: CompiledGlyph = glyphs['?'] ?? {
    width: Math.max(3, cellWidth - 1),
    height: cellHeight,
    rows: Array.from({ length: cellHeight }, (_, y) =>
      y === 0 || y === cellHeight - 1
        ? '1'.repeat(Math.max(3, cellWidth - 1))
        : '0'.repeat(Math.max(3, cellWidth - 1))
    ),
  };

  const locales = options.locales
    ? Array.from(options.locales)
    : ['en', 'pl', 'de', 'cs', 'fi'];

  return {
    id: options.id,
    name: options.name,
    author: options.author,
    license: options.license,
    baseWidth: cellWidth,
    baseHeight: cellHeight,
    lineHeight: cellHeight,
    defaultSpacing: options.defaultSpacing ?? 1,
    supportedLocales: locales,
    fallbackGlyph,
    glyphs,
  };
}

/**
 * Compiles a plain-text Bitmap Distribution Format (.bdf) font into a `VirtualFontSpec`.
 */
export function compileBdfFont(
  bdfContent: string,
  options: FontCompileOptions
): VirtualFontSpec {
  const lines = bdfContent.split(/\r?\n/);
  let cellWidth = 6;
  let cellHeight = 8;

  const rawByCode = new Map<number, string[]>();
  let currentEncoding = -1;
  let currentBbxW = 6;
  let currentBbxH = 8;
  let inBitmap = false;
  let bitmapHexLines: string[] = [];

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (line.startsWith('FONTBOUNDINGBOX ')) {
      const parts = line.split(/\s+/);
      cellWidth = Math.max(1, Number(parts[1]) || 6);
      cellHeight = Math.max(1, Number(parts[2]) || 8);
    } else if (line.startsWith('STARTCHAR ')) {
      currentEncoding = -1;
      currentBbxW = cellWidth;
      currentBbxH = cellHeight;
      inBitmap = false;
      bitmapHexLines = [];
    } else if (line.startsWith('ENCODING ')) {
      currentEncoding = Number(line.split(/\s+/)[1]);
    } else if (line.startsWith('BBX ')) {
      const parts = line.split(/\s+/);
      currentBbxW = Math.max(1, Number(parts[1]) || cellWidth);
      currentBbxH = Math.max(1, Number(parts[2]) || cellHeight);
    } else if (line === 'BITMAP') {
      inBitmap = true;
    } else if (line === 'ENDCHAR') {
      if (currentEncoding >= 0 && bitmapHexLines.length > 0) {
        const rows: string[] = [];
        for (let y = 0; y < currentBbxH && y < bitmapHexLines.length; y++) {
          const hex = bitmapHexLines[y];
          const bits = parseInt(hex, 16)
            .toString(2)
            .padStart(hex.length * 4, '0')
            .slice(0, currentBbxW);
          rows.push(bits);
        }
        rawByCode.set(currentEncoding, padOrResizeHeight(rows, cellHeight));
      }
      inBitmap = false;
    } else if (inBitmap && line.length > 0) {
      bitmapHexLines.push(line);
    }
  }

  function resolveRawCharRows(ch: string): string[] | null {
    const code = ch.codePointAt(0);
    if (code === undefined) return null;
    if (code === 0x20 || code === 0xa0) {
      return Array.from({ length: cellHeight }, () => '0'.repeat(cellWidth));
    }
    return rawByCode.get(code) ?? null;
  }

  const trimHorizontal = options.trimHorizontal ?? true;
  const synthesizeMissing = options.synthesizeMissingDiacritics ?? true;
  const targetChars = resolveTargetCharacters(options);
  const glyphs: Record<string, CompiledGlyph> = {};

  for (const ch of targetChars) {
    const isSpace = ch === ' ' || ch === '\u00a0';
    let rawRows = resolveRawCharRows(ch);

    if (!rawRows && synthesizeMissing) {
      rawRows = synthesizeNationalGlyph(
        ch,
        (baseChar) => resolveRawCharRows(baseChar),
        cellWidth,
        cellHeight
      );
    }

    if (!rawRows) continue;

    glyphs[ch] = trimHorizontal
      ? trimGlyphHorizontally(rawRows, isSpace, cellWidth)
      : {
          width: rawRows[0]?.length ?? cellWidth,
          height: rawRows.length,
          rows: rawRows,
        };
  }

  const fallbackGlyph: CompiledGlyph = glyphs['?'] ?? {
    width: Math.max(3, cellWidth - 1),
    height: cellHeight,
    rows: Array.from({ length: cellHeight }, () => '1'.repeat(Math.max(3, cellWidth - 1))),
  };

  return {
    id: options.id,
    name: options.name,
    author: options.author,
    license: options.license,
    baseWidth: cellWidth,
    baseHeight: cellHeight,
    lineHeight: cellHeight,
    defaultSpacing: options.defaultSpacing ?? 1,
    supportedLocales: options.locales
      ? Array.from(options.locales)
      : ['en', 'pl', 'de', 'cs', 'fi'],
    fallbackGlyph,
    glyphs,
  };
}

/**
 * Validates whether a compiled `VirtualFontSpec` covers all characters used across
 * the provided translation dictionaries (e.g. `locales/en.json`, `locales/pl.json`).
 */
export function validateFontLocaleCoverage(
  font: VirtualFontSpec,
  dictionaries: ReadonlyArray<Record<string, string>>
): FontCoverageReport {
  const uniqueChars = new Set<string>();
  const missingChars: string[] = [];

  for (const dict of dictionaries) {
    for (const text of Object.values(dict)) {
      for (const ch of text) {
        if (ch.codePointAt(0)! >= 0x20) {
          uniqueChars.add(ch);
        }
      }
    }
  }

  for (const ch of uniqueChars) {
    if (!(ch in font.glyphs) && !(ch.toUpperCase() in font.glyphs)) {
      missingChars.push(ch);
    }
  }

  return {
    fontId: font.id,
    covered: missingChars.length === 0,
    totalUniqueChars: uniqueChars.size,
    missingChars,
  };
}
