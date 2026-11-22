import { PaletteColorToken } from './Palette';
import {
  CHARSET_PRESETS,
  synthesizeNationalGlyph,
} from './VirtualFontCompiler';
import {
  HP_100LX_6X8_FONT,
  IBM_BIOS_8X8_FONT,
  IBM_CGATHIN_8X8_FONT,
} from './fonts';

export type TextAlign = 'left' | 'center' | 'right';

export interface CompiledGlyph {
  readonly width: number;
  readonly height: number;
  readonly offsetX?: number;
  readonly offsetY?: number;
  readonly advance?: number;
  /** 1-bit pixel mask rows ('1' = active virtual pixel, '0' = transparent) */
  readonly rows: readonly string[];
}

export interface VirtualFontSpec {
  readonly id: string;
  readonly name: string;
  readonly author?: string;
  readonly license?: string;
  readonly baseWidth: number;
  readonly baseHeight: number;
  readonly lineHeight: number;
  readonly defaultSpacing: number;
  readonly supportedLocales: readonly string[];
  readonly fallbackGlyph: CompiledGlyph;
  readonly glyphs: Readonly<Record<string, CompiledGlyph>>;
}

export type VirtualFontRef = string | VirtualFontSpec;

export interface VirtualTextOptions {
  color: PaletteColorToken;
  font?: VirtualFontRef;
  scale?: number;
  align?: TextAlign;
  letterSpacing?: number;
  lineHeight?: number;
  shadowColor?: PaletteColorToken;
  shadowOffset?: { x: number; y: number };
}

export interface PixelPlotter {
  setPixel(x: number, y: number, color: PaletteColorToken): void;
}

export const DEFAULT_FONT_ID = 'f3-retro-5x7';

/**
 * Built-in 5x7 bitmap glyph definitions for the classic engine fallback font.
 */
const GLYPHS_5X7: Record<string, readonly string[]> = {
  ' ': ['00000', '00000', '00000', '00000', '00000', '00000', '00000'],
  '!': ['00100', '00100', '00100', '00100', '00100', '00000', '00100'],
  '"': ['01010', '01010', '01010', '00000', '00000', '00000', '00000'],
  '#': ['01010', '11111', '01010', '01010', '11111', '01010', '00000'],
  '$': ['00100', '01111', '10100', '01110', '00101', '11110', '00100'],
  '%': ['11001', '11010', '00100', '01000', '10110', '00110', '00000'],
  '&': ['01100', '10010', '10100', '01000', '10101', '10010', '01101'],
  "'": ['00100', '00100', '00000', '00000', '00000', '00000', '00000'],
  '(': ['00010', '00100', '01000', '01000', '01000', '00100', '00010'],
  ')': ['01000', '00100', '00010', '00010', '00010', '00100', '01000'],
  '*': ['00100', '10101', '01110', '11111', '01110', '10101', '00000'],
  '+': ['00000', '00100', '00100', '11111', '00100', '00100', '00000'],
  ',': ['00000', '00000', '00000', '00000', '00100', '00100', '01000'],
  '-': ['00000', '00000', '00000', '11111', '00000', '00000', '00000'],
  '–': ['00000', '00000', '00000', '11111', '00000', '00000', '00000'],
  '—': ['00000', '00000', '00000', '11111', '00000', '00000', '00000'],
  '.': ['00000', '00000', '00000', '00000', '00000', '00100', '00100'],
  '/': ['00001', '00010', '00100', '00100', '01000', '10000', '00000'],
  '0': ['01110', '10001', '10011', '10101', '11001', '10001', '01110'],
  '1': ['00100', '01100', '00100', '00100', '00100', '00100', '01110'],
  '2': ['01110', '10001', '00001', '00110', '01000', '10000', '11111'],
  '3': ['11110', '00001', '00001', '01110', '00001', '00001', '11110'],
  '4': ['00010', '00110', '01010', '10010', '11111', '00010', '00010'],
  '5': ['11111', '10000', '11110', '00001', '00001', '10001', '01110'],
  '6': ['00110', '01000', '10000', '11110', '10001', '10001', '01110'],
  '7': ['11111', '00001', '00010', '00100', '01000', '01000', '01000'],
  '8': ['01110', '10001', '10001', '01110', '10001', '10001', '01110'],
  '9': ['01110', '10001', '10001', '01111', '00001', '00010', '01100'],
  ':': ['00000', '00100', '00100', '00000', '00100', '00100', '00000'],
  ';': ['00000', '00100', '00000', '00000', '00100', '00100', '01000'],
  '<': ['00010', '00100', '01000', '10000', '01000', '00100', '00010'],
  '=': ['00000', '00000', '11111', '00000', '11111', '00000', '00000'],
  '>': ['01000', '00100', '00010', '00001', '00010', '00100', '01000'],
  '?': ['01110', '10001', '00010', '00100', '00100', '00000', '00100'],
  '@': ['01110', '10001', '10111', '10101', '10111', '10000', '01110'],
  A: ['01110', '10001', '10001', '11111', '10001', '10001', '10001'],
  B: ['11110', '10001', '10001', '11110', '10001', '10001', '11110'],
  C: ['01110', '10001', '10000', '10000', '10000', '10001', '01110'],
  D: ['11100', '10010', '10001', '10001', '10001', '10010', '11100'],
  E: ['11111', '10000', '10000', '11110', '10000', '10000', '11111'],
  F: ['11111', '10000', '10000', '11110', '10000', '10000', '10000'],
  G: ['01110', '10001', '10000', '10111', '10001', '10001', '01110'],
  H: ['10001', '10001', '10001', '11111', '10001', '10001', '10001'],
  I: ['01110', '00100', '00100', '00100', '00100', '00100', '01110'],
  J: ['00111', '00010', '00010', '00010', '10010', '10010', '01100'],
  K: ['10001', '10010', '10100', '11000', '10100', '10010', '10001'],
  L: ['10000', '10000', '10000', '10000', '10000', '10000', '11111'],
  M: ['10001', '11011', '10101', '10101', '10001', '10001', '10001'],
  N: ['10001', '11001', '10101', '10011', '10001', '10001', '10001'],
  O: ['01110', '10001', '10001', '10001', '10001', '10001', '01110'],
  P: ['11110', '10001', '10001', '11110', '10000', '10000', '10000'],
  Q: ['01110', '10001', '10001', '10001', '10101', '10010', '01101'],
  R: ['11110', '10001', '10001', '11110', '10100', '10010', '10001'],
  S: ['01111', '10000', '10000', '01110', '00001', '00001', '11110'],
  T: ['11111', '00100', '00100', '00100', '00100', '00100', '00100'],
  U: ['10001', '10001', '10001', '10001', '10001', '10001', '01110'],
  V: ['10001', '10001', '10001', '10001', '10001', '01010', '00100'],
  W: ['10001', '10001', '10001', '10101', '10101', '11011', '10001'],
  X: ['10001', '10001', '01010', '00100', '01010', '10001', '10001'],
  Y: ['10001', '10001', '01010', '00100', '00100', '00100', '00100'],
  Z: ['11111', '00001', '00010', '00100', '01000', '10000', '11111'],
  '[': ['01110', '01000', '01000', '01000', '01000', '01000', '01110'],
  '\\': ['10000', '01000', '00100', '00100', '00010', '00001', '00000'],
  ']': ['01110', '00010', '00010', '00010', '00010', '00010', '01110'],
  '^': ['00100', '01010', '10001', '00000', '00000', '00000', '00000'],
  _: ['00000', '00000', '00000', '00000', '00000', '00000', '11111'],
  '`': ['01000', '00100', '00000', '00000', '00000', '00000', '00000'],
  a: ['00000', '00000', '01110', '00001', '01111', '10001', '01111'],
  b: ['10000', '10000', '11110', '10001', '10001', '10001', '11110'],
  c: ['00000', '00000', '01110', '10000', '10000', '10001', '01110'],
  d: ['00001', '00001', '01111', '10001', '10001', '10001', '01111'],
  e: ['00000', '00000', '01110', '10001', '11111', '10000', '01110'],
  f: ['00110', '01001', '01000', '11100', '01000', '01000', '01000'],
  g: ['00000', '01111', '10001', '10001', '01111', '00001', '01110'],
  h: ['10000', '10000', '11110', '10001', '10001', '10001', '10001'],
  i: ['00100', '00000', '01100', '00100', '00100', '00100', '01110'],
  j: ['00010', '00000', '00110', '00010', '00010', '10010', '01100'],
  k: ['10000', '10000', '10010', '10100', '11000', '10100', '10010'],
  l: ['01100', '00100', '00100', '00100', '00100', '00100', '01110'],
  m: ['00000', '00000', '11010', '10101', '10101', '10001', '10001'],
  n: ['00000', '00000', '11110', '10001', '10001', '10001', '10001'],
  o: ['00000', '00000', '01110', '10001', '10001', '10001', '01110'],
  p: ['00000', '11110', '10001', '10001', '11110', '10000', '10000'],
  q: ['00000', '01111', '10001', '10001', '01111', '00001', '00001'],
  r: ['00000', '00000', '10110', '11001', '10000', '10000', '10000'],
  s: ['00000', '00000', '01111', '10000', '01110', '00001', '11110'],
  t: ['01000', '01000', '11100', '01000', '01000', '01001', '00110'],
  u: ['00000', '00000', '10001', '10001', '10001', '10011', '01101'],
  v: ['00000', '00000', '10001', '10001', '10001', '01010', '00100'],
  w: ['00000', '00000', '10001', '10001', '10101', '10101', '01010'],
  x: ['00000', '00000', '10001', '01010', '00100', '01010', '10001'],
  y: ['00000', '10001', '10001', '10001', '01111', '00001', '01110'],
  z: ['00000', '00000', '11111', '00010', '00100', '01000', '11111'],
  '{': ['00010', '00100', '00100', '01000', '00100', '00100', '00010'],
  '|': ['00100', '00100', '00100', '00100', '00100', '00100', '00100'],
  '}': ['01000', '00100', '00100', '00010', '00100', '00100', '01000'],
  '~': ['00000', '01000', '10101', '00010', '00000', '00000', '00000'],
  // Polish diacritics (uppercase and lowercase)
  Ą: ['01110', '10001', '10001', '11111', '10001', '10011', '00010'],
  Ć: ['00110', '01100', '10001', '10000', '10000', '10001', '01110'],
  Ę: ['11111', '10000', '11110', '10000', '11111', '00010', '00100'],
  Ł: ['10000', '10100', '11000', '10100', '10000', '10000', '11111'],
  Ń: ['00110', '10101', '11001', '10101', '10011', '10001', '10001'],
  Ó: ['00110', '01110', '10001', '10001', '10001', '10001', '01110'],
  Ś: ['00110', '01111', '10000', '01110', '00001', '00001', '11110'],
  Ź: ['00110', '11111', '00010', '00100', '01000', '10000', '11111'],
  Ż: ['00100', '11111', '00010', '00100', '01000', '10000', '11111'],
  ą: ['00000', '01110', '00001', '01111', '10001', '01111', '00010'],
  ć: ['00010', '00100', '01110', '10000', '10000', '10001', '01110'],
  ę: ['00000', '01110', '10001', '11111', '10000', '01110', '00010'],
  ł: ['01100', '00100', '01110', '00100', '00100', '00100', '01110'],
  ń: ['00010', '00100', '11110', '10001', '10001', '10001', '10001'],
  ó: ['00010', '00100', '01110', '10001', '10001', '10001', '01110'],
  ś: ['00010', '00100', '01111', '10000', '01110', '00001', '11110'],
  ź: ['00010', '00100', '11111', '00010', '00100', '01000', '11111'],
  ż: ['00100', '00000', '11111', '00010', '00100', '01000', '11111'],
  // UI Symbols / Directional Arrows / Icons
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
  '🎮': ['01110', '11111', '10101', '11111', '11011', '10001', '00000'],
};

function createF3Retro5x7FontSpec(): VirtualFontSpec {
  const glyphs: Record<string, CompiledGlyph> = {};
  for (const [ch, rows] of Object.entries(GLYPHS_5X7)) {
    glyphs[ch] = {
      width: 5,
      height: 7,
      rows,
    };
  }

  // Synthesize German, Czech, and Finnish characters via NFD decomposition
  const extraNationalChars =
    CHARSET_PRESETS.de + CHARSET_PRESETS.cs + CHARSET_PRESETS.fi;
  for (const ch of extraNationalChars) {
    if (!(ch in glyphs)) {
      const synthRows = synthesizeNationalGlyph(
        ch,
        (base) => GLYPHS_5X7[base] ?? null,
        5,
        7
      );
      if (synthRows) {
        glyphs[ch] = {
          width: 5,
          height: 7,
          rows: synthRows,
        };
      }
    }
  }

  return {
    id: DEFAULT_FONT_ID,
    name: 'F3 Retro 5x7',
    author: 'f3engine',
    license: 'MIT',
    baseWidth: 5,
    baseHeight: 7,
    lineHeight: 7,
    defaultSpacing: 1,
    supportedLocales: ['en', 'pl', 'de', 'cs', 'fi'],
    fallbackGlyph: glyphs['?'],
    glyphs,
  };
}

export const F3_RETRO_5X7_FONT: VirtualFontSpec = createF3Retro5x7FontSpec();

/**
 * Bitmap font registry and rasterizer operating strictly on the virtual pixel grid.
 * Supports multiple compiled font faces (`VirtualFontSpec`), integer scaling on virtual pixels,
 * horizontal alignment, word wrapping, and drop shadows.
 */
export class VirtualFont {
  public static readonly BASE_WIDTH = 5;
  public static readonly BASE_HEIGHT = 7;

  private static readonly registry = new Map<string, VirtualFontSpec>([
    [F3_RETRO_5X7_FONT.id, F3_RETRO_5X7_FONT],
    [HP_100LX_6X8_FONT.id, HP_100LX_6X8_FONT],
    [IBM_BIOS_8X8_FONT.id, IBM_BIOS_8X8_FONT],
    [IBM_CGATHIN_8X8_FONT.id, IBM_CGATHIN_8X8_FONT],
  ]);

  private static defaultFontId = DEFAULT_FONT_ID;

  /**
   * Registers a compiled 1-bit pixel-mask font specification (`VirtualFontSpec`)
   * so it can be referenced by ID across any surface or UI decorator.
   */
  public static registerFont(spec: VirtualFontSpec): void {
    VirtualFont.registry.set(spec.id, spec);
  }

  public static unregisterFont(id: string): boolean {
    if (id === DEFAULT_FONT_ID) return false;
    return VirtualFont.registry.delete(id);
  }

  public static hasFont(id: string): boolean {
    return VirtualFont.registry.has(id);
  }

  public static listFonts(): VirtualFontSpec[] {
    return Array.from(VirtualFont.registry.values());
  }

  public static setDefaultFont(font: VirtualFontRef): void {
    if (typeof font === 'string') {
      if (VirtualFont.registry.has(font)) {
        VirtualFont.defaultFontId = font;
      }
    } else {
      VirtualFont.registerFont(font);
      VirtualFont.defaultFontId = font.id;
    }
  }

  public static getDefaultFont(): VirtualFontSpec {
    return (
      VirtualFont.registry.get(VirtualFont.defaultFontId) ?? F3_RETRO_5X7_FONT
    );
  }

  public static getFont(font?: VirtualFontRef): VirtualFontSpec {
    if (!font) {
      return VirtualFont.getDefaultFont();
    }
    if (typeof font === 'string') {
      return VirtualFont.registry.get(font) ?? VirtualFont.getDefaultFont();
    }
    return font;
  }

  public static normalizeScale(scale = 1): number {
    return Math.max(1, Math.round(scale));
  }

  public static getGlyphWidth(scale = 1, font?: VirtualFontRef): number {
    const spec = VirtualFont.getFont(font);
    return spec.baseWidth * VirtualFont.normalizeScale(scale);
  }

  public static getGlyphHeight(scale = 1, font?: VirtualFontRef): number {
    const spec = VirtualFont.getFont(font);
    return spec.baseHeight * VirtualFont.normalizeScale(scale);
  }

  public static getSpacing(
    scale = 1,
    customSpacing?: number,
    font?: VirtualFontRef
  ): number {
    if (customSpacing !== undefined) {
      return Math.max(0, Math.round(customSpacing));
    }
    const spec = VirtualFont.getFont(font);
    return Math.max(0, spec.defaultSpacing * VirtualFont.normalizeScale(scale));
  }

  public static measureText(
    text: string,
    scale = 1,
    letterSpacing?: number,
    font?: VirtualFontRef
  ): { width: number; height: number } {
    const spec = VirtualFont.getFont(font);
    const normScale = VirtualFont.normalizeScale(scale);
    const chars = Array.from(text);
    const glyphH = spec.baseHeight * normScale;
    const spacing = VirtualFont.getSpacing(scale, letterSpacing, spec);

    if (chars.length === 0) {
      return { width: 0, height: glyphH };
    }

    let totalWidth = 0;
    for (let i = 0; i < chars.length; i++) {
      const ch = chars[i];
      const glyph =
        spec.glyphs[ch] ??
        spec.glyphs[ch.toUpperCase()] ??
        spec.fallbackGlyph;
      const adv = (glyph.advance ?? glyph.width) * normScale;
      totalWidth += adv;
      if (i < chars.length - 1) {
        totalWidth += spacing;
      }
    }

    return {
      width: totalWidth,
      height: glyphH,
    };
  }

  public static wrapText(
    text: string,
    maxWidth: number,
    scale = 1,
    letterSpacing?: number,
    font?: VirtualFontRef
  ): string[] {
    const words = text.split(' ');
    const lines: string[] = [];
    let currentLine = '';

    for (const word of words) {
      const candidate = currentLine ? `${currentLine} ${word}` : word;
      const { width } = VirtualFont.measureText(
        candidate,
        scale,
        letterSpacing,
        font
      );
      if (width <= maxWidth || !currentLine) {
        currentLine = candidate;
      } else {
        lines.push(currentLine);
        currentLine = word;
      }
    }

    if (currentLine) {
      lines.push(currentLine);
    }

    return lines.length > 0 ? lines : [''];
  }

  public static drawText(
    plotter: PixelPlotter,
    text: string,
    x: number,
    y: number,
    options: VirtualTextOptions
  ): { width: number; height: number } {
    const spec = VirtualFont.getFont(options.font);
    const scale = options.scale ?? 1;
    const normScale = VirtualFont.normalizeScale(scale);
    const align = options.align ?? 'left';
    const spacing = VirtualFont.getSpacing(scale, options.letterSpacing, spec);
    const measured = VirtualFont.measureText(
      text,
      scale,
      options.letterSpacing,
      spec
    );

    let startX = Math.round(x);
    if (align === 'center') {
      startX = Math.round(x - measured.width / 2);
    } else if (align === 'right') {
      startX = Math.round(x - measured.width);
    }
    const startY = Math.round(y);

    if (options.shadowColor) {
      const sx = options.shadowOffset?.x ?? normScale;
      const sy = options.shadowOffset?.y ?? normScale;
      VirtualFont.rasterizeRun(
        plotter,
        spec,
        text,
        startX + sx,
        startY + sy,
        normScale,
        spacing,
        options.shadowColor
      );
    }

    VirtualFont.rasterizeRun(
      plotter,
      spec,
      text,
      startX,
      startY,
      normScale,
      spacing,
      options.color
    );

    return measured;
  }

  public static drawWrappedText(
    plotter: PixelPlotter,
    text: string,
    x: number,
    y: number,
    maxWidth: number,
    options: VirtualTextOptions
  ): { width: number; height: number; lines: number } {
    const spec = VirtualFont.getFont(options.font);
    const scale = options.scale ?? 1;
    const glyphH = VirtualFont.getGlyphHeight(scale, spec);
    const lineGap = options.lineHeight ?? Math.max(2, Math.round(2 * scale));
    const lines = VirtualFont.wrapText(
      text,
      maxWidth,
      scale,
      options.letterSpacing,
      spec
    );

    let maxLineW = 0;
    lines.forEach((line, idx) => {
      const lineY = Math.round(y + idx * (glyphH + lineGap));
      const m = VirtualFont.drawText(plotter, line, x, lineY, options);
      if (m.width > maxLineW) {
        maxLineW = m.width;
      }
    });

    const totalH =
      lines.length * glyphH + Math.max(0, lines.length - 1) * lineGap;
    return { width: maxLineW, height: totalH, lines: lines.length };
  }

  private static rasterizeRun(
    plotter: PixelPlotter,
    spec: VirtualFontSpec,
    text: string,
    startX: number,
    startY: number,
    normScale: number,
    spacing: number,
    color: PaletteColorToken
  ): void {
    const chars = Array.from(text);
    let cursorX = startX;

    for (const ch of chars) {
      const glyph =
        spec.glyphs[ch] ??
        spec.glyphs[ch.toUpperCase()] ??
        spec.fallbackGlyph;

      const srcW = glyph.width;
      const srcH = glyph.height;
      const dstW = srcW * normScale;
      const dstH = srcH * normScale;
      const offsetX = (glyph.offsetX ?? 0) * normScale;
      const offsetY = (glyph.offsetY ?? 0) * normScale;

      for (let py = 0; py < dstH; py++) {
        const srcY = Math.min(srcH - 1, Math.floor(py / normScale));
        const rowBits = glyph.rows[srcY];
        if (!rowBits) continue;
        for (let px = 0; px < dstW; px++) {
          const srcX = Math.min(srcW - 1, Math.floor(px / normScale));
          if (rowBits[srcX] === '1') {
            plotter.setPixel(
              cursorX + offsetX + px,
              startY + offsetY + py,
              color
            );
          }
        }
      }

      const advance = (glyph.advance ?? srcW) * normScale;
      cursorX += advance + spacing;
    }
  }
}
