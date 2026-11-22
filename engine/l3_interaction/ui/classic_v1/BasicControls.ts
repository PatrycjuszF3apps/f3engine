import { ControlDirection } from '../../../l2_runtime/input/ControlEvents';
import { ControlNode } from '../../../l2_runtime/nodes/ControlNode';
import { PaletteColorToken } from '../../../l1_infrastructure/Palette';
import { VirtualFontRef } from '../../../l1_infrastructure/VirtualFont';
import { IVirtualSurface, VirtualRect } from '../../../l1_infrastructure/VirtualSurface';
import { VirtualPanelOptions } from '../../VirtualUIDecorator';

export type DynamicText = string | (() => string);

export function resolveText(value: DynamicText): string {
  return typeof value === 'function' ? value() : value;
}

export interface PanelControlProps extends VirtualPanelOptions {}

/**
 * Basic themed panel control in the `UIKit.ClassicV1` namespace.
 */
export class PanelControl extends ControlNode<PanelControlProps> {
  constructor(id: string, props: PanelControlProps = {}) {
    super(id, props);
    this.interactive = false;
  }

  protected override onRender(
    _surface: IVirtualSurface,
    bounds: VirtualRect
  ): void {
    const ui = this.getUI();
    if (!ui || bounds.width <= 0 || bounds.height <= 0) return;
    ui.drawPanel(bounds, this.props);
  }
}

export interface BadgeControlProps {
  text: DynamicText;
  bgColor?: PaletteColorToken | (() => PaletteColorToken);
  borderColor?: PaletteColorToken | (() => PaletteColorToken | undefined);
  textColor?: PaletteColorToken | (() => PaletteColorToken);
  font?: VirtualFontRef;
  scale?: number | (() => number);
  paddingX?: number;
  paddingY?: number;
  alignRight?: boolean;
}

/**
 * Compact status/brand badge control in the `UIKit.ClassicV1` namespace.
 */
export class BadgeControl extends ControlNode<BadgeControlProps> {
  private lastMeasuredRect: VirtualRect = { x: 0, y: 0, width: 0, height: 0 };

  constructor(id: string, props: BadgeControlProps) {
    super(id, props);
    this.interactive = false;
  }

  public getLastMeasuredRect(): VirtualRect {
    return this.lastMeasuredRect;
  }

  protected override onRender(
    _surface: IVirtualSurface,
    bounds: VirtualRect
  ): void {
    const ui = this.getUI();
    if (!ui) return;

    const text = resolveText(this.props.text);
    const bgColor =
      typeof this.props.bgColor === 'function'
        ? this.props.bgColor()
        : this.props.bgColor;
    const borderColor =
      typeof this.props.borderColor === 'function'
        ? this.props.borderColor()
        : this.props.borderColor;
    const textColor =
      typeof this.props.textColor === 'function'
        ? this.props.textColor()
        : this.props.textColor;
    const scale =
      typeof this.props.scale === 'function'
        ? this.props.scale()
        : this.props.scale;

    this.lastMeasuredRect = ui.drawBadge(bounds.x, bounds.y, text, {
      bgColor,
      borderColor,
      textColor,
      font: this.props.font,
      scale,
      paddingX: this.props.paddingX,
      paddingY: this.props.paddingY,
      alignRight: this.props.alignRight,
    });
  }
}

export interface ScoreCardControlProps {
  label: DynamicText;
  value: DynamicText;
  accent?: boolean | (() => boolean);
}

/**
 * Single scoreboard metric card control in the `UIKit.ClassicV1` namespace.
 */
export class ScoreCardControl extends ControlNode<ScoreCardControlProps> {
  constructor(id: string, props: ScoreCardControlProps) {
    super(id, props);
    this.interactive = false;
  }

  protected override onRender(
    _surface: IVirtualSurface,
    bounds: VirtualRect
  ): void {
    const ui = this.getUI();
    if (!ui || bounds.width <= 0 || bounds.height <= 0) return;

    const label = resolveText(this.props.label);
    const value = resolveText(this.props.value);
    const isAccent =
      typeof this.props.accent === 'function'
        ? this.props.accent()
        : Boolean(this.props.accent);

    ui.drawScoreCard(bounds, label, value, isAccent);
  }
}

export interface ScoreCardDescriptor extends ScoreCardControlProps {
  id: string;
}

export interface ScoreCardGroupProps {
  cards: ScoreCardDescriptor[];
  direction?: 'row' | 'column';
  gap?: number;
}

/**
 * Higher-level composite control that owns a collection of `ScoreCardControl` children
 * and automatically arranges them in a horizontal row or vertical column.
 */
export class ScoreCardGroupControl extends ControlNode<ScoreCardGroupProps> {
  private readonly cardControls: ScoreCardControl[] = [];

  constructor(id: string, props: ScoreCardGroupProps) {
    super(id, props);
    this.interactive = false;

    for (const desc of props.cards) {
      const card = new ScoreCardControl(`${id}-card-${desc.id}`, {
        label: desc.label,
        value: desc.value,
        accent: desc.accent,
      });
      this.cardControls.push(card);
      this.addChild(card);
    }
  }

  protected override onLayout(bounds: VirtualRect): void {
    const count = this.cardControls.length;
    if (count === 0) return;

    const dir = this.props.direction ?? 'row';
    const gap = this.props.gap ?? 3;

    if (dir === 'row') {
      const cardW = Math.floor((bounds.width - gap * (count - 1)) / count);
      this.cardControls.forEach((card, idx) => {
        card.setBounds({
          x: bounds.x + idx * (cardW + gap),
          y: bounds.y,
          width: cardW,
          height: bounds.height,
        });
      });
    } else {
      const cardH = Math.floor((bounds.height - gap * (count - 1)) / count);
      this.cardControls.forEach((card, idx) => {
        card.setBounds({
          x: bounds.x,
          y: bounds.y + idx * (cardH + gap),
          width: bounds.width,
          height: cardH,
        });
      });
    }
  }
}

export interface ButtonControlProps {
  label: DynamicText;
  onClick: () => void;
  active?: boolean | (() => boolean);
  accent?: boolean | (() => boolean);
  font?: VirtualFontRef;
  fontScale?: number;
}

/**
 * Interactive button control node in the `UIKit.ClassicV1` namespace.
 * Automatically responds to pointer hover, pointer click, and keyboard/gamepad focus.
 */
export class ButtonControl extends ControlNode<ButtonControlProps> {
  constructor(id: string, props: ButtonControlProps) {
    super(id, props);
    this.interactive = true;
    this.focusable = true;
    this.cursor = 'pointer';
  }

  protected override onClick(): void {
    this.props.onClick();
  }

  protected override onRender(
    surface: IVirtualSurface,
    bounds: VirtualRect
  ): void {
    const ui = this.getUI();
    if (!ui || bounds.width <= 0 || bounds.height <= 0) return;

    const theme = ui.getTheme();
    const font = this.props.font ?? ui.getBodyFont();
    const isActive =
      typeof this.props.active === 'function'
        ? this.props.active()
        : Boolean(this.props.active);
    const isAccent =
      typeof this.props.accent === 'function'
        ? this.props.accent()
        : Boolean(this.props.accent);
    const highlighted = Boolean(isActive || this.hovered || this.focused);

    const bgColor = isAccent
      ? theme.accent
      : highlighted
        ? theme.panelBg
        : theme.panelAlt;
    const borderColor =
      highlighted || isAccent ? theme.borderHighlight : theme.border;
    const textColor = isAccent
      ? theme.textInverse
      : highlighted
        ? theme.accentBright
        : theme.textMain;

    ui.drawPanel(bounds, {
      bgColor,
      borderColor,
      radius: 2,
    });

    const label = resolveText(this.props.label);
    const uiScale = ui.getViewport().getUIScale();
    const candidateScale =
      this.props.fontScale ??
      (uiScale >= 1.75 && bounds.height >= 28 ? 2 : 1);
    const measuredAtCandidate = surface.measureText(
      label,
      candidateScale,
      undefined,
      font
    );
    const fontScale =
      measuredAtCandidate.width > bounds.width - 4 ? 1 : candidateScale;
    const measured = surface.measureText(label, fontScale, undefined, font);
    const textX = Math.round(bounds.x + bounds.width / 2);
    const textY = Math.round(bounds.y + (bounds.height - measured.height) / 2);

    surface.drawText(label, textX, textY, {
      color: textColor,
      font,
      scale: fontScale,
      align: 'center',
    });
  }
}

export interface DPadControlProps {
  /** Optional callback in addition to emitting normalized `DirectionControlEvent` into `InputRouter`. */
  onDirection?: (direction: ControlDirection) => void;
}

/**
 * Higher-level composite directional pad (D-Pad) control node in `UIKit.ClassicV1`.
 * Owns 4 child `ButtonControl` nodes (`up`, `left`, `down`, `right`), manages their layout,
 * and emits normalized `DirectionControlEvent`s down the application tree when clicked.
 */
export class DPadControl extends ControlNode<DPadControlProps> {
  private readonly upBtn: ButtonControl;
  private readonly leftBtn: ButtonControl;
  private readonly downBtn: ButtonControl;
  private readonly rightBtn: ButtonControl;

  constructor(id: string, props: DPadControlProps = {}) {
    super(id, props);
    this.interactive = false;

    const triggerDir = (dir: ControlDirection) => {
      this.props.onDirection?.(dir);
      this.getInput()?.emitDirection(dir, 'virtual-control');
    };

    this.upBtn = new ButtonControl(`${id}-up`, {
      label: '▲',
      onClick: () => triggerDir('UP'),
    });
    this.leftBtn = new ButtonControl(`${id}-left`, {
      label: '◀',
      onClick: () => triggerDir('LEFT'),
    });
    this.downBtn = new ButtonControl(`${id}-down`, {
      label: '▼',
      onClick: () => triggerDir('DOWN'),
    });
    this.rightBtn = new ButtonControl(`${id}-right`, {
      label: '▶',
      onClick: () => triggerDir('RIGHT'),
    });

    this.addControls(this.upBtn, this.leftBtn, this.downBtn, this.rightBtn);
  }

  protected override onLayout(bounds: VirtualRect): void {
    const gap = Math.max(1, Math.round(bounds.height * 0.06));
    const btnH = Math.max(10, Math.floor((bounds.height - gap) / 2));
    const btnW = Math.max(12, Math.floor((bounds.width - gap * 2) / 3));
    const glyphScale = Math.max(0.85, Math.min(1.4, (btnH - 4) / 7));

    this.upBtn.setProps({ fontScale: glyphScale }, false);
    this.leftBtn.setProps({ fontScale: glyphScale }, false);
    this.downBtn.setProps({ fontScale: glyphScale }, false);
    this.rightBtn.setProps({ fontScale: glyphScale }, false);

    this.upBtn.setBounds({
      x: bounds.x + btnW + gap,
      y: bounds.y,
      width: btnW,
      height: btnH,
    });
    this.leftBtn.setBounds({
      x: bounds.x,
      y: bounds.y + btnH + gap,
      width: btnW,
      height: btnH,
    });
    this.downBtn.setBounds({
      x: bounds.x + btnW + gap,
      y: bounds.y + btnH + gap,
      width: btnW,
      height: btnH,
    });
    this.rightBtn.setBounds({
      x: bounds.x + (btnW + gap) * 2,
      y: bounds.y + btnH + gap,
      width: btnW,
      height: btnH,
    });
  }
}
