import { ColorPalette, PaletteColorToken, PaletteIndex } from './Palette';
import {
  PixelPlotter,
  VirtualFont,
  VirtualFontRef,
  VirtualFontSpec,
  VirtualTextOptions,
} from './VirtualFont';

export interface VirtualRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Abstract interface representing a virtual pixel grid surface.
 * Both game code and UI decorator code operate exclusively on this interface,
 * remaining completely decoupled from the physical renderer backend (Canvas 2D / WebGL).
 */
export interface IVirtualSurface extends PixelPlotter {
  readonly width: number;
  readonly height: number;
  getPalette(): ColorPalette;
  clear(color: PaletteColorToken): void;
  setPixel(x: number, y: number, color: PaletteColorToken): void;
  getPixelIndex(x: number, y: number): PaletteIndex;
  fillRect(
    x: number,
    y: number,
    width: number,
    height: number,
    color: PaletteColorToken
  ): void;
  strokeRect(
    x: number,
    y: number,
    width: number,
    height: number,
    color: PaletteColorToken,
    thickness?: number
  ): void;
  fillRoundRect(
    x: number,
    y: number,
    width: number,
    height: number,
    radius: number,
    color: PaletteColorToken
  ): void;
  strokeRoundRect(
    x: number,
    y: number,
    width: number,
    height: number,
    radius: number,
    color: PaletteColorToken
  ): void;
  fillCircle(
    cx: number,
    cy: number,
    radius: number,
    color: PaletteColorToken
  ): void;
  drawLine(
    x0: number,
    y0: number,
    x1: number,
    y1: number,
    color: PaletteColorToken
  ): void;
  fillCheckerRect(
    x: number,
    y: number,
    width: number,
    height: number,
    color: PaletteColorToken,
    step?: number
  ): void;
  drawText(
    text: string,
    x: number,
    y: number,
    options: VirtualTextOptions
  ): { width: number; height: number };
  drawWrappedText(
    text: string,
    x: number,
    y: number,
    maxWidth: number,
    options: VirtualTextOptions
  ): { width: number; height: number; lines: number };
  measureText(
    text: string,
    scale?: number,
    letterSpacing?: number,
    font?: VirtualFontRef
  ): { width: number; height: number };
  getFontFace(): VirtualFontSpec;
  setFontFace(font: VirtualFontRef): void;
  setClipRect(rect: VirtualRect | null): void;
}

/**
 * Indexed Framebuffer for the virtual pixel grid.
 * Every virtual pixel stores strictly a color index into the declared ColorPalette.
 */
export class VirtualFramebuffer implements IVirtualSurface {
  public width: number;
  public height: number;
  private indices: Uint8Array;
  private palette: ColorPalette;
  private fontFace: VirtualFontSpec;
  private clipRect: VirtualRect | null = null;

  constructor(
    width: number,
    height: number,
    palette: ColorPalette,
    font?: VirtualFontRef
  ) {
    this.width = Math.max(1, Math.round(width));
    this.height = Math.max(1, Math.round(height));
    this.palette = palette;
    this.fontFace = VirtualFont.getFont(font);
    this.indices = new Uint8Array(this.width * this.height);
  }

  public resize(width: number, height: number): void {
    const nextW = Math.max(1, Math.round(width));
    const nextH = Math.max(1, Math.round(height));
    if (nextW === this.width && nextH === this.height) {
      return;
    }
    this.width = nextW;
    this.height = nextH;
    this.indices = new Uint8Array(this.width * this.height);
    this.clipRect = null;
  }

  public setPalette(palette: ColorPalette): void {
    this.palette = palette;
  }

  public getPalette(): ColorPalette {
    return this.palette;
  }

  public getIndexBuffer(): Uint8Array {
    return this.indices;
  }

  public setClipRect(rect: VirtualRect | null): void {
    if (!rect) {
      this.clipRect = null;
      return;
    }
    this.clipRect = {
      x: Math.max(0, Math.round(rect.x)),
      y: Math.max(0, Math.round(rect.y)),
      width: Math.max(0, Math.round(rect.width)),
      height: Math.max(0, Math.round(rect.height)),
    };
  }

  public clear(color: PaletteColorToken): void {
    const idx = this.palette.resolveIndex(color);
    this.indices.fill(idx);
  }

  public setPixel(x: number, y: number, color: PaletteColorToken): void {
    const ix = Math.round(x);
    const iy = Math.round(y);
    if (!this.isInside(ix, iy)) return;
    const idx = this.palette.resolveIndex(color);
    this.indices[iy * this.width + ix] = idx;
  }

  public setPixelIndex(x: number, y: number, paletteIndex: PaletteIndex): void {
    const ix = Math.round(x);
    const iy = Math.round(y);
    if (!this.isInside(ix, iy)) return;
    this.indices[iy * this.width + ix] = paletteIndex;
  }

  public getPixelIndex(x: number, y: number): PaletteIndex {
    const ix = Math.round(x);
    const iy = Math.round(y);
    if (ix < 0 || ix >= this.width || iy < 0 || iy >= this.height) {
      return 0;
    }
    return this.indices[iy * this.width + ix];
  }

  public fillRect(
    x: number,
    y: number,
    width: number,
    height: number,
    color: PaletteColorToken
  ): void {
    const idx = this.palette.resolveIndex(color);
    const bounds = this.clampBounds(x, y, width, height);
    if (!bounds) return;

    for (let py = bounds.y0; py < bounds.y1; py++) {
      const rowOffset = py * this.width;
      this.indices.fill(idx, rowOffset + bounds.x0, rowOffset + bounds.x1);
    }
  }

  public strokeRect(
    x: number,
    y: number,
    width: number,
    height: number,
    color: PaletteColorToken,
    thickness = 1
  ): void {
    const t = Math.max(1, Math.round(thickness));
    const rx = Math.round(x);
    const ry = Math.round(y);
    const rw = Math.round(width);
    const rh = Math.round(height);
    if (rw <= 0 || rh <= 0) return;

    this.fillRect(rx, ry, rw, t, color);
    this.fillRect(rx, ry + rh - t, rw, t, color);
    this.fillRect(rx, ry + t, t, Math.max(0, rh - t * 2), color);
    this.fillRect(rx + rw - t, ry + t, t, Math.max(0, rh - t * 2), color);
  }

  public fillRoundRect(
    x: number,
    y: number,
    width: number,
    height: number,
    radius: number,
    color: PaletteColorToken
  ): void {
    const rx = Math.round(x);
    const ry = Math.round(y);
    const rw = Math.round(width);
    const rh = Math.round(height);
    if (rw <= 0 || rh <= 0) return;

    const r = Math.max(0, Math.min(Math.round(radius), Math.floor(Math.min(rw, rh) / 2)));
    if (r <= 0) {
      this.fillRect(rx, ry, rw, rh, color);
      return;
    }

    const idx = this.palette.resolveIndex(color);
    for (let dy = 0; dy < rh; dy++) {
      let inset = 0;
      if (dy < r) {
        const cy = r - dy - 0.5;
        inset = Math.max(0, Math.ceil(r - Math.sqrt(Math.max(0, r * r - cy * cy))));
      } else if (dy >= rh - r) {
        const cy = dy - (rh - r) + 0.5;
        inset = Math.max(0, Math.ceil(r - Math.sqrt(Math.max(0, r * r - cy * cy))));
      }
      const lineX = rx + inset;
      const lineW = rw - inset * 2;
      if (lineW > 0) {
        const bounds = this.clampBounds(lineX, ry + dy, lineW, 1);
        if (bounds) {
          const rowOffset = bounds.y0 * this.width;
          this.indices.fill(idx, rowOffset + bounds.x0, rowOffset + bounds.x1);
        }
      }
    }
  }

  public strokeRoundRect(
    x: number,
    y: number,
    width: number,
    height: number,
    radius: number,
    color: PaletteColorToken
  ): void {
    const rx = Math.round(x);
    const ry = Math.round(y);
    const rw = Math.round(width);
    const rh = Math.round(height);
    if (rw <= 0 || rh <= 0) return;

    const r = Math.max(0, Math.min(Math.round(radius), Math.floor(Math.min(rw, rh) / 2)));
    if (r <= 1) {
      this.strokeRect(rx, ry, rw, rh, color, 1);
      return;
    }

    const idx = this.palette.resolveIndex(color);
    // Top and bottom edges
    for (let px = rx + 1; px < rx + rw - 1; px++) {
      this.setPixelIndex(px, ry, idx);
      this.setPixelIndex(px, ry + rh - 1, idx);
    }
    // Left and right edges
    for (let py = ry + 1; py < ry + rh - 1; py++) {
      this.setPixelIndex(rx, py, idx);
      this.setPixelIndex(rx + rw - 1, py, idx);
    }
    // Inner corner pixels for 1px rounding
    this.setPixelIndex(rx + 1, ry + 1, idx);
    this.setPixelIndex(rx + rw - 2, ry + 1, idx);
    this.setPixelIndex(rx + 1, ry + rh - 2, idx);
    this.setPixelIndex(rx + rw - 2, ry + rh - 2, idx);
  }

  public fillCircle(
    cx: number,
    cy: number,
    radius: number,
    color: PaletteColorToken
  ): void {
    const r = Math.max(0, Math.round(radius));
    const centerX = Math.round(cx);
    const centerY = Math.round(cy);
    const idx = this.palette.resolveIndex(color);

    if (r === 0) {
      this.setPixelIndex(centerX, centerY, idx);
      return;
    }

    const rSq = r * r;
    for (let dy = -r; dy <= r; dy++) {
      for (let dx = -r; dx <= r; dx++) {
        if (dx * dx + dy * dy <= rSq) {
          this.setPixelIndex(centerX + dx, centerY + dy, idx);
        }
      }
    }
  }

  public drawLine(
    x0: number,
    y0: number,
    x1: number,
    y1: number,
    color: PaletteColorToken
  ): void {
    const idx = this.palette.resolveIndex(color);
    let cx = Math.round(x0);
    let cy = Math.round(y0);
    const tx = Math.round(x1);
    const ty = Math.round(y1);

    const dx = Math.abs(tx - cx);
    const sx = cx < tx ? 1 : -1;
    const dy = -Math.abs(ty - cy);
    const sy = cy < ty ? 1 : -1;
    let err = dx + dy;

    while (true) {
      this.setPixelIndex(cx, cy, idx);
      if (cx === tx && cy === ty) break;
      const e2 = 2 * err;
      if (e2 >= dy) {
        err += dy;
        cx += sx;
      }
      if (e2 <= dx) {
        err += dx;
        cy += sy;
      }
    }
  }

  /**
   * Fills a rectangle using checkerboard dithering strictly with a palette color,
   * creating a dimmed modal backdrop effect without violating palette constraints.
   */
  public fillCheckerRect(
    x: number,
    y: number,
    width: number,
    height: number,
    color: PaletteColorToken,
    step = 2
  ): void {
    const idx = this.palette.resolveIndex(color);
    const bounds = this.clampBounds(x, y, width, height);
    if (!bounds) return;
    const mod = Math.max(1, Math.round(step));

    for (let py = bounds.y0; py < bounds.y1; py++) {
      const rowOffset = py * this.width;
      for (let px = bounds.x0; px < bounds.x1; px++) {
        if ((px + py) % mod === 0) {
          this.indices[rowOffset + px] = idx;
        }
      }
    }
  }

  public getFontFace(): VirtualFontSpec {
    return this.fontFace;
  }

  public setFontFace(font: VirtualFontRef): void {
    this.fontFace = VirtualFont.getFont(font);
  }

  public drawText(
    text: string,
    x: number,
    y: number,
    options: VirtualTextOptions
  ): { width: number; height: number } {
    return VirtualFont.drawText(this, text, x, y, {
      ...options,
      font: options.font ?? this.fontFace,
    });
  }

  public drawWrappedText(
    text: string,
    x: number,
    y: number,
    maxWidth: number,
    options: VirtualTextOptions
  ): { width: number; height: number; lines: number } {
    return VirtualFont.drawWrappedText(this, text, x, y, maxWidth, {
      ...options,
      font: options.font ?? this.fontFace,
    });
  }

  public measureText(
    text: string,
    scale = 1,
    letterSpacing?: number,
    font?: VirtualFontRef
  ): { width: number; height: number } {
    return VirtualFont.measureText(
      text,
      scale,
      letterSpacing,
      font ?? this.fontFace
    );
  }

  private isInside(x: number, y: number): boolean {
    if (x < 0 || x >= this.width || y < 0 || y >= this.height) {
      return false;
    }
    if (this.clipRect) {
      return (
        x >= this.clipRect.x &&
        x < this.clipRect.x + this.clipRect.width &&
        y >= this.clipRect.y &&
        y < this.clipRect.y + this.clipRect.height
      );
    }
    return true;
  }

  private clampBounds(
    x: number,
    y: number,
    width: number,
    height: number
  ): { x0: number; y0: number; x1: number; y1: number } | null {
    const rx = Math.round(x);
    const ry = Math.round(y);
    const rw = Math.round(width);
    const rh = Math.round(height);
    if (rw <= 0 || rh <= 0) return null;

    let minX = 0;
    let minY = 0;
    let maxX = this.width;
    let maxY = this.height;

    if (this.clipRect) {
      minX = Math.max(minX, this.clipRect.x);
      minY = Math.max(minY, this.clipRect.y);
      maxX = Math.min(maxX, this.clipRect.x + this.clipRect.width);
      maxY = Math.min(maxY, this.clipRect.y + this.clipRect.height);
    }

    const x0 = Math.max(minX, rx);
    const y0 = Math.max(minY, ry);
    const x1 = Math.min(maxX, rx + rw);
    const y1 = Math.min(maxY, ry + rh);

    if (x0 >= x1 || y0 >= y1) return null;
    return { x0, y0, x1, y1 };
  }
}
