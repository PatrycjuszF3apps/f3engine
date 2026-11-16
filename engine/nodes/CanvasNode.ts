import {
  IVirtualSurface,
  VirtualFramebuffer,
  VirtualRect,
} from '../VirtualSurface';
import { Node } from './Node';

/**
 * A 2D spatial node that occupies a bounding rectangle (`VirtualRect`) on the virtual pixel grid
 * and optionally renders visual content onto `IVirtualSurface`.
 *
 * Also supports an optional isolated offscreen buffer (`useOwnSurface`) that caches its pixels
 * into an internal `VirtualFramebuffer` and blits onto the parent surface.
 */
export class CanvasNode<
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  TProps extends object = Record<string, any>,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  TState extends object = Record<string, any>,
> extends Node<TProps, TState> {
  public isPositionRelativeToParent = false;

  protected _x = 0;
  protected _y = 0;
  protected _width = 0;
  protected _height = 0;

  protected useOwnSurface = false;
  private _ownBuffer: VirtualFramebuffer | null = null;
  private _surfaceDirty = true;

  constructor(id: string, props?: TProps, useOwnSurface = false) {
    super(id, props);
    this.useOwnSurface = useOwnSurface;
  }

  public get x(): number {
    return this._x;
  }

  public set x(value: number) {
    this._x = Math.round(value);
  }

  public get y(): number {
    return this._y;
  }

  public set y(value: number) {
    this._y = Math.round(value);
  }

  public get width(): number {
    return this._width;
  }

  public set width(value: number) {
    this._width = Math.max(0, Math.round(value));
  }

  public get height(): number {
    return this._height;
  }

  public set height(value: number) {
    this._height = Math.max(0, Math.round(value));
  }

  public getBounds(): VirtualRect {
    return {
      x: this._x,
      y: this._y,
      width: this._width,
      height: this._height,
    };
  }

  public setBounds(rect: Partial<VirtualRect>): this {
    if (rect.x !== undefined) this._x = Math.round(rect.x);
    if (rect.y !== undefined) this._y = Math.round(rect.y);
    if (rect.width !== undefined) {
      this._width = Math.max(0, Math.round(rect.width));
    }
    if (rect.height !== undefined) {
      this._height = Math.max(0, Math.round(rect.height));
    }
    this._surfaceDirty = true;
    return this;
  }

  /**
   * Resolves the global bounding rectangle on the virtual viewport pixel grid.
   */
  public getGlobalBounds(): VirtualRect {
    if (!this.isPositionRelativeToParent || !this.parent) {
      return this.getBounds();
    }
    if (this.parent instanceof CanvasNode) {
      const parentGlobal = this.parent.getGlobalBounds();
      return {
        x: parentGlobal.x + this._x,
        y: parentGlobal.y + this._y,
        width: this._width,
        height: this._height,
      };
    }
    return this.getBounds();
  }

  public containsPoint(vx: number, vy: number): boolean {
    const b = this.getGlobalBounds();
    return (
      b.width > 0 &&
      b.height > 0 &&
      vx >= b.x &&
      vx < b.x + b.width &&
      vy >= b.y &&
      vy < b.y + b.height
    );
  }

  public markSurfaceDirty(): void {
    this._surfaceDirty = true;
  }

  /**
   * Executes this node's visual rendering pass onto the provided virtual surface.
   */
  public render(surface: IVirtualSurface): void {
    if (!this.visible || this.destroyed) return;

    const bounds = this.getGlobalBounds();

    if (this.useOwnSurface && bounds.width > 0 && bounds.height > 0) {
      this.ensureOwnFramebuffer(surface, bounds.width, bounds.height);
      if (this._ownBuffer) {
        if (this._surfaceDirty) {
          this._ownBuffer.setPalette(surface.getPalette());
          this._ownBuffer.setFontFace(surface.getFontFace());
          this.onRender(this._ownBuffer, {
            x: 0,
            y: 0,
            width: bounds.width,
            height: bounds.height,
          });
          this._surfaceDirty = false;
        }
        this.blitOwnFramebuffer(surface, bounds);
        return;
      }
    }

    this.onRender(surface, bounds);
  }

  /**
   * Override in subclasses to draw node visuals onto the virtual pixel grid.
   * Nodes that act purely as logic or layout containers do not need to override this method.
   */
  protected onRender(
    _surface: IVirtualSurface,
    _bounds: VirtualRect
  ): void {}

  protected override onDestroy(): void {
    this._ownBuffer = null;
  }

  private ensureOwnFramebuffer(
    parentSurface: IVirtualSurface,
    w: number,
    h: number
  ): void {
    if (!this._ownBuffer) {
      this._ownBuffer = new VirtualFramebuffer(
        w,
        h,
        parentSurface.getPalette(),
        parentSurface.getFontFace()
      );
      this._surfaceDirty = true;
      return;
    }
    if (this._ownBuffer.width !== w || this._ownBuffer.height !== h) {
      this._ownBuffer.resize(w, h);
      this._surfaceDirty = true;
    }
  }

  private blitOwnFramebuffer(
    target: IVirtualSurface,
    bounds: VirtualRect
  ): void {
    if (!this._ownBuffer) return;
    const srcW = this._ownBuffer.width;
    const srcH = this._ownBuffer.height;
    const raw = this._ownBuffer.getIndexBuffer();
    const paletteEntries = target.getPalette().getEntries();

    for (let sy = 0; sy < srcH; sy++) {
      const rowOffset = sy * srcW;
      for (let sx = 0; sx < srcW; sx++) {
        const idx = raw[rowOffset + sx];
        const entry = paletteEntries[idx];
        if (entry) {
          target.setPixel(bounds.x + sx, bounds.y + sy, entry.token);
        }
      }
    }
  }
}
