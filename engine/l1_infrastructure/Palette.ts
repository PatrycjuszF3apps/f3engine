export type PaletteColorToken = string;
export type PaletteIndex = number;
export type PaletteDefinition = Record<PaletteColorToken, string>;

export interface RGBAColor {
  r: number;
  g: number;
  b: number;
  a: number;
}

/**
 * Represents a color palette declared by an application for the virtual viewport.
 * Guarantees that every virtual pixel on the surface uses strictly indexed colors from this palette.
 */
export class ColorPalette {
  private readonly tokens: PaletteColorToken[] = [];
  private readonly hexColors: string[] = [];
  private readonly rgbaColors: RGBAColor[] = [];
  private readonly rgba32: Uint32Array;
  private readonly tokenToIndex = new Map<PaletteColorToken, PaletteIndex>();
  private readonly hexToIndex = new Map<string, PaletteIndex>();
  public readonly pixelated: boolean;

  constructor(definition: PaletteDefinition, pixelated = false) {
    const entries = Object.entries(definition);
    if (entries.length === 0) {
      throw new Error('ColorPalette requires at least one color definition.');
    }
    if (entries.length > 256) {
      throw new Error('ColorPalette supports at most 256 indexed colors.');
    }

    this.pixelated = pixelated;
    this.rgba32 = new Uint32Array(entries.length);

    entries.forEach(([token, hex], index) => {
      const normalizedHex = ColorPalette.normalizeHex(hex);
      const rgba = ColorPalette.parseHex(normalizedHex);

      this.tokens.push(token);
      this.hexColors.push(normalizedHex);
      this.rgbaColors.push(rgba);

      // Little-endian ABGR packed integer for fast ImageData (Uint32Array) blitting
      this.rgba32[index] =
        ((rgba.a & 0xff) << 24) |
        ((rgba.b & 0xff) << 16) |
        ((rgba.g & 0xff) << 8) |
        (rgba.r & 0xff);

      this.tokenToIndex.set(token, index);
      if (!this.hexToIndex.has(normalizedHex)) {
        this.hexToIndex.set(normalizedHex, index);
      }
    });
  }

  /**
   * Resolves a color token or HEX string strictly to an index in the declared palette.
   * If a raw color is not directly defined, it quantizes to the nearest RGB entry in the palette.
   */
  public resolveIndex(colorOrToken: PaletteColorToken | PaletteIndex): PaletteIndex {
    if (typeof colorOrToken === 'number') {
      const clamped = Math.max(0, Math.min(this.tokens.length - 1, Math.floor(colorOrToken)));
      return clamped;
    }

    const byToken = this.tokenToIndex.get(colorOrToken);
    if (byToken !== undefined) {
      return byToken;
    }

    const normalized = ColorPalette.normalizeHex(colorOrToken);
    const byHex = this.hexToIndex.get(normalized);
    if (byHex !== undefined) {
      return byHex;
    }

    // Quantize to the nearest color in the declared palette
    const target = ColorPalette.parseHex(normalized);
    let bestIndex = 0;
    let bestDist = Number.POSITIVE_INFINITY;

    for (let i = 0; i < this.rgbaColors.length; i++) {
      const c = this.rgbaColors[i];
      const dr = c.r - target.r;
      const dg = c.g - target.g;
      const db = c.b - target.b;
      const dist = dr * dr + dg * dg + db * db;
      if (dist < bestDist) {
        bestDist = dist;
        bestIndex = i;
      }
    }

    return bestIndex;
  }

  public getHex(indexOrToken: PaletteColorToken | PaletteIndex): string {
    const idx = this.resolveIndex(indexOrToken);
    return this.hexColors[idx] ?? this.hexColors[0];
  }

  public getRGBA(indexOrToken: PaletteColorToken | PaletteIndex): RGBAColor {
    const idx = this.resolveIndex(indexOrToken);
    return this.rgbaColors[idx] ?? this.rgbaColors[0];
  }

  public getUint32Buffer(): Uint32Array {
    return this.rgba32;
  }

  public getSize(): number {
    return this.tokens.length;
  }

  public getEntries(): ReadonlyArray<{ index: number; token: string; hex: string; rgba: RGBAColor }> {
    return this.tokens.map((token, index) => ({
      index,
      token,
      hex: this.hexColors[index],
      rgba: this.rgbaColors[index],
    }));
  }

  private static normalizeHex(input: string): string {
    const trimmed = input.trim().toLowerCase();
    if (!trimmed.startsWith('#')) {
      return '#000000';
    }
    if (trimmed.length === 4) {
      const r = trimmed[1];
      const g = trimmed[2];
      const b = trimmed[3];
      return `#${r}${r}${g}${g}${b}${b}`;
    }
    if (trimmed.length >= 7) {
      return trimmed.slice(0, 7);
    }
    return '#000000';
  }

  private static parseHex(hex: string): RGBAColor {
    const clean = hex.replace('#', '');
    const num = Number.parseInt(clean, 16);
    if (Number.isNaN(num)) {
      return { r: 0, g: 0, b: 0, a: 255 };
    }
    return {
      r: (num >> 16) & 0xff,
      g: (num >> 8) & 0xff,
      b: num & 0xff,
      a: 255,
    };
  }
}
