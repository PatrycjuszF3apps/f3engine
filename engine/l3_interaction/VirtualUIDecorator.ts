import { PaletteColorToken } from '../l1_infrastructure/Palette';
import { IVirtualSurface, VirtualRect } from '../l1_infrastructure/VirtualSurface';
import {
  TextAlign,
  VirtualFont,
  VirtualFontRef,
  VirtualFontSpec,
} from '../l1_infrastructure/VirtualFont';
import { VirtualViewport } from '../l1_infrastructure/VirtualViewport';

export interface VirtualUITheme {
  bgOuter: PaletteColorToken;
  panelBg: PaletteColorToken;
  panelAlt: PaletteColorToken;
  border: PaletteColorToken;
  borderHighlight: PaletteColorToken;
  textMain: PaletteColorToken;
  textMuted: PaletteColorToken;
  textInverse: PaletteColorToken;
  accent: PaletteColorToken;
  accentBright: PaletteColorToken;
  overlayDim: PaletteColorToken;
  bodyFont?: VirtualFontRef;
  headingFont?: VirtualFontRef;
}

export const DEFAULT_UI_THEME: VirtualUITheme = {
  bgOuter: 'bgOuter',
  panelBg: 'panelBg',
  panelAlt: 'panelAlt',
  border: 'border',
  borderHighlight: 'borderHighlight',
  textMain: 'textMain',
  textMuted: 'textMuted',
  textInverse: 'textInverse',
  accent: 'accent',
  accentBright: 'accentBright',
  overlayDim: 'overlayDim',
};

export type HitLayer = 'hud' | 'modal';

export interface VirtualHitRegion {
  id: string;
  rect: VirtualRect;
  layer: HitLayer;
  onClick?: () => void;
  onHover?: () => void;
}

export interface VirtualPanelOptions {
  bgColor?: PaletteColorToken;
  borderColor?: PaletteColorToken;
  shadowColor?: PaletteColorToken;
  radius?: number;
  borderThickness?: number;
}

export interface VirtualButtonOptions {
  active?: boolean;
  accent?: boolean;
  font?: VirtualFontRef;
  fontScale?: number;
  layer?: HitLayer;
  onHover?: () => void;
}

/**
 * Object-oriented UI Decorator for the Virtual Viewport.
 * Renders scalable interface components (panels, score cards, buttons, D-Pad, badges,
 * bitmap text) strictly onto the virtual pixel grid using the declared palette.
 * Also handles virtual hit-testing for mouse pointer events.
 */
export class VirtualUIDecorator {
  private readonly viewport: VirtualViewport;
  private theme: VirtualUITheme;
  private hitRegions: VirtualHitRegion[] = [];
  private hoveredRegionId: string | null = null;
  private modalActive = false;

  constructor(viewport: VirtualViewport, theme: VirtualUITheme = DEFAULT_UI_THEME) {
    this.viewport = viewport;
    this.theme = { ...theme };
    if (theme.bodyFont) {
      this.viewport.getSurface().setFontFace(theme.bodyFont);
    }

    this.viewport.onPointerMove(({ vx, vy }) => {
      this.handlePointerMove(vx, vy);
    });

    this.viewport.onPointerClick(({ vx, vy }) => {
      this.handlePointerClick(vx, vy);
    });

    this.viewport.onPointerLeave(() => {
      if (this.hoveredRegionId !== null) {
        this.hoveredRegionId = null;
        this.viewport.requestRender();
      }
    });
  }

  public getSurface(): IVirtualSurface {
    return this.viewport.getSurface();
  }

  public getViewport(): VirtualViewport {
    return this.viewport;
  }

  public getTheme(): VirtualUITheme {
    return this.theme;
  }

  public setTheme(theme: VirtualUITheme): void {
    this.theme = { ...theme };
    if (theme.bodyFont) {
      this.viewport.getSurface().setFontFace(theme.bodyFont);
    }
  }

  /**
   * Configures simultaneous body and heading font faces for multi-font UI rendering.
   */
  public setFonts(fonts: {
    body?: VirtualFontRef;
    heading?: VirtualFontRef;
  }): void {
    if (fonts.body !== undefined) {
      this.theme.bodyFont = fonts.body;
      this.viewport.getSurface().setFontFace(fonts.body);
    }
    if (fonts.heading !== undefined) {
      this.theme.headingFont = fonts.heading;
    }
  }

  public getBodyFont(): VirtualFontSpec {
    return this.theme.bodyFont
      ? VirtualFont.getFont(this.theme.bodyFont)
      : this.viewport.getSurface().getFontFace();
  }

  public getHeadingFont(): VirtualFontSpec {
    return this.theme.headingFont
      ? VirtualFont.getFont(this.theme.headingFont)
      : this.getBodyFont();
  }

  /**
   * Scales a dimension (in virtual pixels) according to the viewport's current UI scale factor.
   */
  public scale(value: number): number {
    return Math.max(1, Math.round(value * this.viewport.getUIScale()));
  }

  /**
   * Scales font size on the virtual pixel grid.
   */
  public scaleFont(baseScale = 1): number {
    return Math.max(0.75, baseScale * this.viewport.getUIScale());
  }

  /**
   * Begins a new UI decorator frame and resets registered hit-testing regions.
   */
  public beginFrame(modalActive = false): void {
    this.hitRegions = [];
    this.modalActive = modalActive;
  }

  public setModalActive(active: boolean): void {
    this.modalActive = active;
  }

  public isHovered(id: string): boolean {
    return this.hoveredRegionId === id;
  }

  public registerHitRegion(region: VirtualHitRegion): void {
    this.hitRegions.push({
      ...region,
      rect: {
        x: Math.round(region.rect.x),
        y: Math.round(region.rect.y),
        width: Math.round(region.rect.width),
        height: Math.round(region.rect.height),
      },
    });
  }

  public drawModalBackdrop(rect?: VirtualRect): void {
    const surface = this.getSurface();
    const target = rect ?? {
      x: 0,
      y: 0,
      width: surface.width,
      height: surface.height,
    };
    surface.fillCheckerRect(
      target.x,
      target.y,
      target.width,
      target.height,
      this.theme.overlayDim,
      2
    );
  }

  public drawPanel(rect: VirtualRect, options: VirtualPanelOptions = {}): void {
    const surface = this.getSurface();
    const pixelated = surface.getPalette().pixelated;
    const bg = options.bgColor ?? this.theme.panelBg;
    const border = options.borderColor ?? this.theme.border;
    const radius = pixelated ? 0 : (options.radius ?? 3);

    if (options.shadowColor) {
      const offset = pixelated ? 2 : 1;
      surface.fillRect(
        rect.x + offset,
        rect.y + offset,
        rect.width,
        rect.height,
        options.shadowColor
      );
    }

    if (radius > 0) {
      surface.fillRoundRect(rect.x, rect.y, rect.width, rect.height, radius, bg);
      surface.strokeRoundRect(
        rect.x,
        rect.y,
        rect.width,
        rect.height,
        radius,
        border
      );
    } else {
      surface.fillRect(rect.x, rect.y, rect.width, rect.height, bg);
      surface.strokeRect(
        rect.x,
        rect.y,
        rect.width,
        rect.height,
        border,
        options.borderThickness ?? 1
      );
    }
  }

  public drawText(
    text: string,
    x: number,
    y: number,
    options: {
      color?: PaletteColorToken;
      font?: VirtualFontRef;
      scale?: number;
      align?: TextAlign;
      shadowColor?: PaletteColorToken;
    } = {}
  ): { width: number; height: number } {
    const surface = this.getSurface();
    return surface.drawText(text, x, y, {
      color: options.color ?? this.theme.textMain,
      font: options.font ?? this.getBodyFont(),
      scale: options.scale ?? 1,
      align: options.align ?? 'left',
      shadowColor: options.shadowColor,
    });
  }

  public drawWrappedText(
    text: string,
    x: number,
    y: number,
    maxWidth: number,
    options: {
      color?: PaletteColorToken;
      font?: VirtualFontRef;
      scale?: number;
      align?: TextAlign;
      lineHeight?: number;
    } = {}
  ): { width: number; height: number; lines: number } {
    const surface = this.getSurface();
    return surface.drawWrappedText(text, x, y, maxWidth, {
      color: options.color ?? this.theme.textMain,
      font: options.font ?? this.getBodyFont(),
      scale: options.scale ?? 1,
      align: options.align ?? 'left',
      lineHeight: options.lineHeight,
    });
  }

  public drawBadge(
    x: number,
    y: number,
    text: string,
    options: {
      bgColor?: PaletteColorToken;
      borderColor?: PaletteColorToken;
      textColor?: PaletteColorToken;
      font?: VirtualFontRef;
      scale?: number;
      paddingX?: number;
      paddingY?: number;
      alignRight?: boolean;
    } = {}
  ): VirtualRect {
    const surface = this.getSurface();
    const font = options.font ?? this.getBodyFont();
    const scale = options.scale ?? 1;
    const padX = options.paddingX ?? Math.max(2, Math.round(3 * scale));
    const padY = options.paddingY ?? Math.max(2, Math.round(2 * scale));
    const measured = surface.measureText(text, scale, undefined, font);
    const w = measured.width + padX * 2;
    const h = measured.height + padY * 2;
    const rx = options.alignRight ? Math.round(x - w) : Math.round(x);
    const ry = Math.round(y);

    surface.fillRect(rx, ry, w, h, options.bgColor ?? this.theme.panelAlt);
    if (options.borderColor) {
      surface.strokeRect(rx, ry, w, h, options.borderColor, 1);
    }
    surface.drawText(text, rx + padX, ry + padY, {
      color: options.textColor ?? this.theme.accentBright,
      font,
      scale,
      align: 'left',
    });

    return { x: rx, y: ry, width: w, height: h };
  }

  public drawScoreCard(
    rect: VirtualRect,
    label: string,
    value: string,
    isAccent = false
  ): void {
    const surface = this.getSurface();
    this.drawPanel(rect, {
      bgColor: this.theme.panelAlt,
      borderColor: this.theme.border,
      radius: 2,
    });

    const uiScale = this.viewport.getUIScale();
    const labelFont = this.getBodyFont();
    const headingFont = this.getHeadingFont();
    const labelScale = uiScale >= 1.75 ? 2 : 1;
    const candidateValScale = uiScale >= 1.5 && rect.height >= 36 ? 2 : 1;

    const labelMetrics = surface.measureText(
      label,
      labelScale,
      undefined,
      labelFont
    );
    const headingAtCandidate = surface.measureText(
      value,
      candidateValScale,
      undefined,
      headingFont
    );
    const valScale =
      headingAtCandidate.width > rect.width - 4 ? 1 : candidateValScale;
    const headingAtScale = surface.measureText(
      value,
      valScale,
      undefined,
      headingFont
    );
    const valueFont =
      headingAtScale.width > rect.width - 4 ? labelFont : headingFont;
    const valMetrics = surface.measureText(value, valScale, undefined, valueFont);

    const totalContentH = labelMetrics.height + valMetrics.height + 3;
    const startY = Math.round(rect.y + (rect.height - totalContentH) / 2);
    const centerX = Math.round(rect.x + rect.width / 2);

    surface.drawText(label, centerX, startY, {
      color: this.theme.textMuted,
      font: labelFont,
      scale: labelScale,
      align: 'center',
    });

    surface.drawText(value, centerX, startY + labelMetrics.height + 3, {
      color: isAccent ? this.theme.accentBright : this.theme.textMain,
      font: valueFont,
      scale: valScale,
      align: 'center',
    });
  }

  public drawButton(
    id: string,
    rect: VirtualRect,
    label: string,
    onClick: () => void,
    options: VirtualButtonOptions = {}
  ): void {
    const surface = this.getSurface();
    const font = options.font ?? this.getBodyFont();
    const layer = options.layer ?? 'hud';
    const hovered = this.isHovered(id) && (!this.modalActive || layer === 'modal');
    const highlighted = Boolean(options.active || hovered);

    const bgColor = options.accent
      ? this.theme.accent
      : highlighted
        ? this.theme.panelBg
        : this.theme.panelAlt;
    const borderColor =
      highlighted || options.accent
        ? this.theme.borderHighlight
        : this.theme.border;
    const textColor = options.accent
      ? this.theme.textInverse
      : highlighted
        ? this.theme.accentBright
        : this.theme.textMain;

    this.drawPanel(rect, {
      bgColor,
      borderColor,
      radius: 2,
    });

    const uiScale = this.viewport.getUIScale();
    const candidateScale = options.fontScale ?? (uiScale >= 1.75 && rect.height >= 28 ? 2 : 1);
    const measuredAtCandidate = surface.measureText(
      label,
      candidateScale,
      undefined,
      font
    );
    const fontScale =
      measuredAtCandidate.width > rect.width - 4 ? 1 : candidateScale;
    const measured = surface.measureText(label, fontScale, undefined, font);
    const textX = Math.round(rect.x + rect.width / 2);
    const textY = Math.round(rect.y + (rect.height - measured.height) / 2);

    surface.drawText(label, textX, textY, {
      color: textColor,
      font,
      scale: fontScale,
      align: 'center',
    });

    this.registerHitRegion({
      id,
      rect,
      layer,
      onClick,
      onHover: options.onHover,
    });
  }

  /**
   * Draws an interactive directional pad (D-Pad) on the virtual pixel grid.
   */
  public drawDpad(
    rect: VirtualRect,
    onDirection: (dir: 'UP' | 'DOWN' | 'LEFT' | 'RIGHT') => void
  ): void {
    const gap = Math.max(1, Math.round(rect.height * 0.06));
    const btnH = Math.max(10, Math.floor((rect.height - gap) / 2));
    const btnW = Math.max(12, Math.floor((rect.width - gap * 2) / 3));

    const upRect: VirtualRect = {
      x: rect.x + btnW + gap,
      y: rect.y,
      width: btnW,
      height: btnH,
    };
    const leftRect: VirtualRect = {
      x: rect.x,
      y: rect.y + btnH + gap,
      width: btnW,
      height: btnH,
    };
    const downRect: VirtualRect = {
      x: rect.x + btnW + gap,
      y: rect.y + btnH + gap,
      width: btnW,
      height: btnH,
    };
    const rightRect: VirtualRect = {
      x: rect.x + (btnW + gap) * 2,
      y: rect.y + btnH + gap,
      width: btnW,
      height: btnH,
    };

    const glyphScale = Math.max(0.85, Math.min(1.4, (btnH - 4) / 7));

    this.drawButton('dpad-up', upRect, '▲', () => onDirection('UP'), {
      fontScale: glyphScale,
    });
    this.drawButton('dpad-left', leftRect, '◀', () => onDirection('LEFT'), {
      fontScale: glyphScale,
    });
    this.drawButton('dpad-down', downRect, '▼', () => onDirection('DOWN'), {
      fontScale: glyphScale,
    });
    this.drawButton('dpad-right', rightRect, '▶', () => onDirection('RIGHT'), {
      fontScale: glyphScale,
    });
  }

  private findTargetRegion(vx: number, vy: number): VirtualHitRegion | null {
    // Search top-down from the last drawn element
    for (let i = this.hitRegions.length - 1; i >= 0; i--) {
      const region = this.hitRegions[i];
      if (this.modalActive && region.layer !== 'modal') {
        continue;
      }
      if (
        vx >= region.rect.x &&
        vx < region.rect.x + region.rect.width &&
        vy >= region.rect.y &&
        vy < region.rect.y + region.rect.height
      ) {
        return region;
      }
    }
    return null;
  }

  private handlePointerMove(vx: number, vy: number): void {
    if (this.hitRegions.length === 0) return;
    const region = this.findTargetRegion(vx, vy);
    const nextId = region?.id ?? null;

    this.viewport.setCursorStyle(region ? 'pointer' : 'default');

    if (nextId !== this.hoveredRegionId) {
      this.hoveredRegionId = nextId;
      region?.onHover?.();
      this.viewport.requestRender();
    }
  }

  private handlePointerClick(vx: number, vy: number): void {
    if (this.hitRegions.length === 0) return;
    const region = this.findTargetRegion(vx, vy);
    if (region?.onClick) {
      region.onClick();
      this.viewport.requestRender();
    }
  }
}
