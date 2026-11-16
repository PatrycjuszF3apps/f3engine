import {
  ActionControlEvent,
  PointerControlEvent,
} from '../input/ControlEvents';
import { ContainerNode } from './ContainerNode';

/**
 * Interactive UI Control node (inspired by WinForms / C# Control & Godot Control).
 * Supports pointer hit-testing, hover/focus states, cursor styles, and modal input barriers.
 */
export class ControlNode<
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  TProps extends object = Record<string, any>,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  TState extends object = Record<string, any>,
> extends ContainerNode<TProps, TState> {
  /** Whether this control can be hit by pointer events (hover / click). */
  public interactive = false;

  /** Whether this control can receive keyboard/gamepad focus. */
  public focusable = false;

  /**
   * When `true` and this control is visible & enabled, blocks pointer, directional,
   * and action events from propagating to background branches underneath this node in Z-order.
   */
  public modal = false;

  /** Cursor style displayed when the pointer hovers over this interactive control. */
  public cursor: 'default' | 'pointer' = 'pointer';

  private _hovered = false;
  private _focused = false;

  public get hovered(): boolean {
    return this._hovered;
  }

  public get focused(): boolean {
    return this._focused;
  }

  public setHovered(hovered: boolean): void {
    if (this._hovered === hovered) return;
    this._hovered = hovered;
    this.onHoverChange(hovered);
    this.requestRender();
  }

  public setFocused(focused: boolean): void {
    if (this._focused === focused) return;
    this._focused = focused;
    this.onFocusChange(focused);
    this.requestRender();
  }

  public triggerClick(event?: PointerControlEvent | ActionControlEvent): void {
    if (!this.isEffectivelyEnabled() || !this.isEffectivelyVisible()) return;
    this.onClick(event);
    this.requestRender();
  }

  protected override onDisable(): void {
    this._hovered = false;
    this._focused = false;
  }

  protected override onVisibilityChanged(visible: boolean): void {
    if (!visible) {
      this._hovered = false;
      this._focused = false;
    }
  }

  protected onHoverChange(_hovered: boolean): void {}

  protected onFocusChange(_focused: boolean): void {}

  protected onClick(_event?: PointerControlEvent | ActionControlEvent): void {}
}
