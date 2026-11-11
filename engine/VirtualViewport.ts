import { ColorPalette, RGBAColor } from './Palette';
import {
  Canvas2DRendererBackend,
  IRendererBackend,
  RendererBackendType,
  WebGLRendererBackend,
} from './RendererBackend';
import { IVirtualSurface, VirtualFramebuffer } from './VirtualSurface';

export type ViewportAspectRatio =
  | '16:9-horizontal'
  | '16:9-portrait'
  | '4:3-horizontal'
  | '4:3-portrait'
  | 'custom';

export const ASPECT_RATIO_VALUES: Record<
  Exclude<ViewportAspectRatio, 'custom'>,
  number
> = {
  '16:9-horizontal': 16 / 9,
  '16:9-portrait': 9 / 16,
  '4:3-horizontal': 4 / 3,
  '4:3-portrait': 3 / 4,
};

export interface VirtualPointerEvent {
  vx: number;
  vy: number;
  originalEvent: MouseEvent;
}

export interface VirtualViewportState {
  virtualWidth: number;
  virtualHeight: number;
  aspectRatio: ViewportAspectRatio;
  windowScalePercent: number;
  lockAspectRatio: boolean;
  uiScale: number;
  uiScaleOverride: number | null;
  physicalWidth: number;
  physicalHeight: number;
  backendType: RendererBackendType;
  cursorInspectorEnabled: boolean;
  cursorPosition: { vx: number; vy: number } | null;
  paletteEntries: ReadonlyArray<{
    index: number;
    token: string;
    hex: string;
    rgba: RGBAColor;
  }>;
}

/**
 * Decoupled hook contract exposed by the engine for external debug tools (e.g. degub_bar).
 * The engine has zero knowledge of any Debug Bar HTML or DOM context.
 */
export interface EngineDebugHooks {
  getState(): VirtualViewportState;
  subscribe(listener: ViewportStateListener): () => void;
  setVirtualGrid(
    width: number,
    aspectRatio?: ViewportAspectRatio,
    customHeight?: number
  ): void;
  setPhysicalScaling(windowScalePercent: number, lockAspectRatio?: boolean): void;
  setUIScaleOverride(scale: number | null): void;
  setRendererBackend(backendOrType: IRendererBackend | RendererBackendType): void;
  setCursorInspectorEnabled(enabled: boolean): void;
  resetToDefaults(): void;
  updatePhysicalSize(): void;
}

export interface VirtualViewportConfig {
  container: HTMLElement;
  virtualWidth: number;
  virtualHeight?: number;
  aspectRatio: ViewportAspectRatio;
  windowScalePercent?: number;
  lockAspectRatio?: boolean;
  uiScaleOverride?: number | null;
  palette: ColorPalette;
  backend?: IRendererBackend;
  canvasAriaLabel?: string;
}

export type ViewportStateListener = (state: VirtualViewportState) => void;

/**
 * Computes virtual height from virtual width and aspect ratio preset.
 */
export function computeHeightForAspectRatio(
  virtualWidth: number,
  aspectRatio: ViewportAspectRatio,
  fallbackHeight = virtualWidth
): number {
  if (aspectRatio === 'custom') {
    return Math.max(64, Math.round(fallbackHeight));
  }
  const ratio = ASPECT_RATIO_VALUES[aspectRatio];
  return Math.max(64, Math.round(virtualWidth / ratio));
}

/**
 * Virtual Viewport ("2D machine screen emulator") managing the virtual pixel grid,
 * indexed color palette, physical scaling inside its host container, and swappable renderer backend.
 * Completely agnostic of any surrounding Debug Bar HTML context.
 */
export class VirtualViewport {
  private readonly hostContainer: HTMLElement;
  private readonly viewportFrameEl: HTMLElement;
  private readonly fxLayerEl: HTMLElement;

  private readonly defaultConfig: {
    virtualWidth: number;
    virtualHeight: number;
    aspectRatio: ViewportAspectRatio;
    windowScalePercent: number;
    lockAspectRatio: boolean;
    uiScaleOverride: number | null;
  };

  private virtualWidth: number;
  private virtualHeight: number;
  private aspectRatio: ViewportAspectRatio;
  private windowScalePercent: number;
  private lockAspectRatio: boolean;
  private uiScaleOverride: number | null;
  private physicalWidth = 300;
  private physicalHeight = 400;
  private cursorInspectorEnabled = false;
  private cursorPosition: { vx: number; vy: number } | null = null;

  private palette: ColorPalette;
  private readonly framebuffer: VirtualFramebuffer;
  private backend: IRendererBackend;
  private canvasAriaLabel?: string;

  private readonly stateListeners = new Set<ViewportStateListener>();
  private readonly pointerMoveListeners = new Set<(e: VirtualPointerEvent) => void>();
  private readonly pointerClickListeners = new Set<(e: VirtualPointerEvent) => void>();
  private readonly pointerLeaveListeners = new Set<() => void>();
  private renderCallback: (() => void) | null = null;

  private readonly handleWindowResize = () => {
    this.updatePhysicalSize();
    this.notifyState();
  };

  private readonly handleMouseMove = (event: MouseEvent) => {
    const coords = this.clientToVirtual(event.clientX, event.clientY);
    if (!coords) return;
    const changed =
      !this.cursorPosition ||
      this.cursorPosition.vx !== coords.vx ||
      this.cursorPosition.vy !== coords.vy;
    this.cursorPosition = coords;

    for (const listener of this.pointerMoveListeners) {
      listener({ vx: coords.vx, vy: coords.vy, originalEvent: event });
    }
    if (changed && this.cursorInspectorEnabled) {
      this.present();
      this.notifyState();
    }
  };

  private readonly handleMouseClick = (event: MouseEvent) => {
    const coords = this.clientToVirtual(event.clientX, event.clientY);
    if (!coords) return;
    for (const listener of this.pointerClickListeners) {
      listener({ vx: coords.vx, vy: coords.vy, originalEvent: event });
    }
  };

  private readonly handleMouseLeave = () => {
    this.setCursorStyle('default');
    this.cursorPosition = null;
    for (const listener of this.pointerLeaveListeners) {
      listener();
    }
    if (this.cursorInspectorEnabled) {
      this.present();
      this.notifyState();
    }
  };

  constructor(config: VirtualViewportConfig) {
    this.hostContainer = config.container;
    this.aspectRatio = config.aspectRatio;
    this.virtualWidth = Math.max(120, Math.round(config.virtualWidth));
    this.virtualHeight =
      config.virtualHeight !== undefined
        ? Math.max(120, Math.round(config.virtualHeight))
        : computeHeightForAspectRatio(this.virtualWidth, this.aspectRatio);

    this.windowScalePercent = config.windowScalePercent ?? 50;
    this.lockAspectRatio = config.lockAspectRatio ?? true;
    this.uiScaleOverride = config.uiScaleOverride ?? null;
    this.palette = config.palette;
    this.canvasAriaLabel = config.canvasAriaLabel;

    this.defaultConfig = {
      virtualWidth: this.virtualWidth,
      virtualHeight: this.virtualHeight,
      aspectRatio: this.aspectRatio,
      windowScalePercent: this.windowScalePercent,
      lockAspectRatio: this.lockAspectRatio,
      uiScaleOverride: this.uiScaleOverride,
    };

    // Build internal viewport frame DOM inside hostContainer
    this.viewportFrameEl = document.createElement('div');
    this.viewportFrameEl.id = 'board-wrapper';
    this.viewportFrameEl.className = 'board-wrapper virtual-viewport-frame video-filter-none';

    this.fxLayerEl = document.createElement('div');
    this.fxLayerEl.className = 'video-fx-layer';
    this.fxLayerEl.setAttribute('aria-hidden', 'true');

    this.hostContainer.innerHTML = '';
    this.hostContainer.appendChild(this.viewportFrameEl);

    this.framebuffer = new VirtualFramebuffer(
      this.virtualWidth,
      this.virtualHeight,
      this.palette
    );

    this.backend = config.backend ?? new Canvas2DRendererBackend();
    this.backend.mount(
      this.viewportFrameEl,
      this.virtualWidth,
      this.virtualHeight,
      this.canvasAriaLabel
    );
    this.viewportFrameEl.appendChild(this.fxLayerEl);

    this.bindEvents();
    this.updatePhysicalSize();
  }

  /**
   * Returns a clean, DOM-agnostic hook object that external debug bars can bind to.
   */
  public getDebugHooks(): EngineDebugHooks {
    return {
      getState: () => this.getState(),
      subscribe: (listener) => this.subscribe(listener),
      setVirtualGrid: (width, aspectRatio, customHeight) =>
        this.setVirtualGrid(width, aspectRatio, customHeight),
      setPhysicalScaling: (windowScalePercent, lockAspectRatio) =>
        this.setPhysicalScaling(windowScalePercent, lockAspectRatio),
      setUIScaleOverride: (scale) => this.setUIScaleOverride(scale),
      setRendererBackend: (backendOrType) => this.setRendererBackend(backendOrType),
      setCursorInspectorEnabled: (enabled) => this.setCursorInspectorEnabled(enabled),
      resetToDefaults: () => this.resetToDefaults(),
      updatePhysicalSize: () => this.updatePhysicalSize(),
    };
  }

  public getSurface(): IVirtualSurface {
    return this.framebuffer;
  }

  public getFramebuffer(): VirtualFramebuffer {
    return this.framebuffer;
  }

  public getFrameElement(): HTMLElement {
    return this.viewportFrameEl;
  }

  public getCanvasElement(): HTMLCanvasElement | null {
    return this.backend.getCanvas();
  }

  public setRenderCallback(cb: (() => void) | null): void {
    this.renderCallback = cb;
  }

  public requestRender(): void {
    if (this.renderCallback) {
      this.renderCallback();
    } else {
      this.present();
    }
  }

  /**
   * Presents the virtual pixel grid onto the active renderer backend (Canvas2D / WebGL).
   * If the cursor coordinate inspector is active, temporarily overlays a virtual pixel
   * crosshair and coordinate tag before presenting.
   */
  public present(): void {
    if (this.cursorInspectorEnabled && this.cursorPosition) {
      const rawBuffer = this.framebuffer.getIndexBuffer();
      const backup = new Uint8Array(rawBuffer);
      this.drawCursorInspectorOverlay(this.cursorPosition.vx, this.cursorPosition.vy);
      this.backend.present(this.framebuffer, this.palette);
      rawBuffer.set(backup);
      return;
    }
    this.backend.present(this.framebuffer, this.palette);
  }

  public setCursorInspectorEnabled(enabled: boolean): void {
    if (this.cursorInspectorEnabled === enabled) return;
    this.cursorInspectorEnabled = enabled;
    this.present();
    this.notifyState();
  }

  public isCursorInspectorEnabled(): boolean {
    return this.cursorInspectorEnabled;
  }

  public getCursorPosition(): { vx: number; vy: number } | null {
    return this.cursorPosition;
  }

  public getPalette(): ColorPalette {
    return this.palette;
  }

  public setPalette(palette: ColorPalette): void {
    this.palette = palette;
    this.framebuffer.setPalette(palette);
    this.requestRender();
    this.notifyState();
  }

  public getVirtualWidth(): number {
    return this.virtualWidth;
  }

  public getVirtualHeight(): number {
    return this.virtualHeight;
  }

  public getAspectRatio(): ViewportAspectRatio {
    return this.aspectRatio;
  }

  public getWindowScalePercent(): number {
    return this.windowScalePercent;
  }

  public isAspectRatioLocked(): boolean {
    return this.lockAspectRatio;
  }

  /**
   * Computes UI and font scaling factor on the virtual pixel grid relative to a 300px baseline,
   * or returns the explicit override multiplier.
   */
  public getUIScale(): number {
    if (this.uiScaleOverride !== null && this.uiScaleOverride > 0) {
      return this.uiScaleOverride;
    }
    const minDim = Math.min(this.virtualWidth, this.virtualHeight);
    return Math.max(0.75, Math.min(3, minDim / 300));
  }

  public getUIScaleOverride(): number | null {
    return this.uiScaleOverride;
  }

  public setUIScaleOverride(scale: number | null): void {
    this.uiScaleOverride = scale;
    this.requestRender();
    this.notifyState();
  }

  /**
   * Updates the virtual pixel grid resolution and aspect ratio preset.
   */
  public setVirtualGrid(
    width: number,
    aspectRatio: ViewportAspectRatio = this.aspectRatio,
    customHeight?: number
  ): void {
    const nextW = Math.max(160, Math.min(1280, Math.round(width)));
    const nextH =
      aspectRatio === 'custom' && customHeight !== undefined
        ? Math.max(160, Math.min(1280, Math.round(customHeight)))
        : computeHeightForAspectRatio(
            nextW,
            aspectRatio,
            customHeight ?? this.virtualHeight
          );

    this.virtualWidth = nextW;
    this.virtualHeight = nextH;
    this.aspectRatio = aspectRatio;

    this.framebuffer.resize(this.virtualWidth, this.virtualHeight);
    this.backend.resizeVirtualGrid(this.virtualWidth, this.virtualHeight);
    this.updatePhysicalSize();
    this.requestRender();
    this.notifyState();
  }

  /**
   * Updates physical scaling parameters inside the host stage.
   */
  public setPhysicalScaling(
    windowScalePercent: number,
    lockAspectRatio = this.lockAspectRatio
  ): void {
    this.windowScalePercent = Math.max(20, Math.min(100, Math.round(windowScalePercent)));
    this.lockAspectRatio = lockAspectRatio;
    this.updatePhysicalSize();
    this.notifyState();
  }

  /**
   * Dynamically hot-swaps the renderer backend (e.g. Canvas 2D <-> WebGL)
   * transparently to game logic and UI decorators.
   */
  public setRendererBackend(backendOrType: IRendererBackend | RendererBackendType): void {
    const nextBackend: IRendererBackend =
      typeof backendOrType === 'string'
        ? backendOrType === 'webgl'
          ? new WebGLRendererBackend()
          : new Canvas2DRendererBackend()
        : backendOrType;

    if (nextBackend.type === this.backend.type && typeof backendOrType === 'string') {
      return;
    }

    this.backend.dispose();
    this.backend = nextBackend;
    this.backend.mount(
      this.viewportFrameEl,
      this.virtualWidth,
      this.virtualHeight,
      this.canvasAriaLabel
    );
    // Ensure the video effects overlay remains on top
    this.viewportFrameEl.appendChild(this.fxLayerEl);
    this.present();
    this.notifyState();
  }

  public getRendererBackendType(): RendererBackendType {
    return this.backend.type;
  }

  public setCanvasAriaLabel(label: string): void {
    this.canvasAriaLabel = label;
    const canvas = this.backend.getCanvas();
    if (canvas) {
      canvas.setAttribute('aria-label', label);
    }
  }

  /**
   * Restores default virtual grid and scaling parameters configured by the application.
   */
  public resetToDefaults(): void {
    this.uiScaleOverride = this.defaultConfig.uiScaleOverride;
    this.windowScalePercent = this.defaultConfig.windowScalePercent;
    this.lockAspectRatio = this.defaultConfig.lockAspectRatio;
    this.setVirtualGrid(
      this.defaultConfig.virtualWidth,
      this.defaultConfig.aspectRatio,
      this.defaultConfig.virtualHeight
    );
  }

  public getState(): VirtualViewportState {
    return {
      virtualWidth: this.virtualWidth,
      virtualHeight: this.virtualHeight,
      aspectRatio: this.aspectRatio,
      windowScalePercent: this.windowScalePercent,
      lockAspectRatio: this.lockAspectRatio,
      uiScale: this.getUIScale(),
      uiScaleOverride: this.uiScaleOverride,
      physicalWidth: this.physicalWidth,
      physicalHeight: this.physicalHeight,
      backendType: this.backend.type,
      cursorInspectorEnabled: this.cursorInspectorEnabled,
      cursorPosition: this.cursorPosition,
      paletteEntries: this.palette.getEntries(),
    };
  }

  public subscribe(listener: ViewportStateListener): () => void {
    this.stateListeners.add(listener);
    listener(this.getState());
    return () => this.stateListeners.delete(listener);
  }

  public onPointerMove(listener: (e: VirtualPointerEvent) => void): () => void {
    this.pointerMoveListeners.add(listener);
    return () => this.pointerMoveListeners.delete(listener);
  }

  public onPointerClick(listener: (e: VirtualPointerEvent) => void): () => void {
    this.pointerClickListeners.add(listener);
    return () => this.pointerClickListeners.delete(listener);
  }

  public onPointerLeave(listener: () => void): () => void {
    this.pointerLeaveListeners.add(listener);
    return () => this.pointerLeaveListeners.delete(listener);
  }

  public setCursorStyle(cursor: 'default' | 'pointer'): void {
    this.viewportFrameEl.style.cursor = cursor;
  }

  /**
   * Computes the physical CSS size of the viewport inside its parent stage container
   * without querying any external debug bar DOM elements.
   */
  public updatePhysicalSize(): void {
    const stageEl = this.hostContainer.parentElement ?? this.hostContainer;
    const stageRect = stageEl.getBoundingClientRect();

    const availW = stageRect.width > 64 ? stageRect.width - 24 : window.innerWidth - 24;
    const availH = stageRect.height > 64 ? stageRect.height - 24 : window.innerHeight - 80;

    const winW = Math.max(240, availW);
    const winH = Math.max(240, availH);

    const scaleFraction = this.windowScalePercent / 100;

    if (this.lockAspectRatio) {
      const aspect = this.virtualWidth / this.virtualHeight;
      const maxFitH = Math.min(winH, winW / aspect);
      const maxFitW = maxFitH * aspect;

      this.physicalWidth = Math.max(120, Math.round(maxFitW * scaleFraction));
      this.physicalHeight = Math.max(120, Math.round(maxFitH * scaleFraction));
    } else {
      this.physicalWidth = Math.max(120, Math.round(winW * scaleFraction));
      this.physicalHeight = Math.max(120, Math.round(winH * scaleFraction));
    }

    this.viewportFrameEl.style.width = `${this.physicalWidth}px`;
    this.viewportFrameEl.style.height = `${this.physicalHeight}px`;
  }

  /**
   * Cleans up event listeners, renderer resources, and mounted DOM nodes so another demo can be initialized cleanly.
   */
  public dispose(): void {
    window.removeEventListener('resize', this.handleWindowResize);
    this.viewportFrameEl.removeEventListener('mousemove', this.handleMouseMove);
    this.viewportFrameEl.removeEventListener('click', this.handleMouseClick);
    this.viewportFrameEl.removeEventListener('mouseleave', this.handleMouseLeave);
    this.renderCallback = null;
    this.stateListeners.clear();
    this.pointerMoveListeners.clear();
    this.pointerClickListeners.clear();
    this.pointerLeaveListeners.clear();
    this.backend.dispose();
    this.viewportFrameEl.remove();
  }

  private bindEvents(): void {
    window.addEventListener('resize', this.handleWindowResize);
    this.viewportFrameEl.addEventListener('mousemove', this.handleMouseMove);
    this.viewportFrameEl.addEventListener('click', this.handleMouseClick);
    this.viewportFrameEl.addEventListener('mouseleave', this.handleMouseLeave);
  }

  private drawCursorInspectorOverlay(vx: number, vy: number): void {
    const fb = this.framebuffer;
    // Crosshair indicating the exact virtual pixel (vx, vy)
    fb.setPixel(vx - 2, vy, 'borderHighlight');
    fb.setPixel(vx + 2, vy, 'borderHighlight');
    fb.setPixel(vx, vy - 2, 'borderHighlight');
    fb.setPixel(vx, vy + 2, 'borderHighlight');
    fb.setPixel(vx, vy, 'targetFill');

    // Coordinate badge "x,y" rendered next to the cursor on the virtual grid
    const label = `${vx},${vy}`;
    const measured = fb.measureText(label, 1);
    const padX = 3;
    const padY = 2;
    const tagW = measured.width + padX * 2;
    const tagH = measured.height + padY * 2;

    let tagX = vx + 6;
    let tagY = vy - tagH - 4;
    if (tagX + tagW > fb.width - 2) {
      tagX = Math.max(2, vx - tagW - 5);
    }
    if (tagY < 2) {
      tagY = Math.min(fb.height - tagH - 2, vy + 6);
    }

    fb.fillRect(tagX, tagY, tagW, tagH, 'panelAlt');
    fb.strokeRect(tagX, tagY, tagW, tagH, 'borderHighlight', 1);
    fb.drawText(label, tagX + padX, tagY + padY, {
      color: 'textMain',
      scale: 1,
    });
  }

  private clientToVirtual(
    clientX: number,
    clientY: number
  ): { vx: number; vy: number } | null {
    const rect = this.viewportFrameEl.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return null;

    const normX = (clientX - rect.left) / rect.width;
    const normY = (clientY - rect.top) / rect.height;

    const vx = Math.max(
      0,
      Math.min(this.virtualWidth - 1, Math.floor(normX * this.virtualWidth))
    );
    const vy = Math.max(
      0,
      Math.min(this.virtualHeight - 1, Math.floor(normY * this.virtualHeight))
    );

    return { vx, vy };
  }

  private notifyState(): void {
    const snapshot = this.getState();
    for (const listener of this.stateListeners) {
      listener(snapshot);
    }
  }
}
