import { ControlDirection, ControlEvent } from '../../input/ControlEvents';
import { ControlNode } from '../../nodes/ControlNode';
import { IVirtualSurface, VirtualRect } from '../../VirtualSurface';
import {
  BadgeControl,
  ButtonControl,
  DPadControl,
  DynamicText,
  ScoreCardDescriptor,
  ScoreCardGroupControl,
  resolveText,
} from './BasicControls';

export type HeaderBarLayoutMode = 'top-bar' | 'left-sidebar';

export interface HeaderBarControlProps {
  brandTitle: DynamicText;
  brandBadge: DynamicText;
  gamepadConnectedLabel: DynamicText;
  gamepadDisconnectedLabel: DynamicText;
  scoreCards: ScoreCardDescriptor[];
  layoutMode?: HeaderBarLayoutMode;
}

export interface HeaderBarControlState {
  gamepadConnected: boolean;
}

/**
 * Higher-level HUD Header container control in `UIKit.ClassicV1`.
 * Manages brand title, brand badge, automatic gamepad connection status badge
 * (listening to `GAMEPAD_STATUS` events from `InputRouter`), and a `ScoreCardGroupControl`
 * containing all metric score cards.
 * Automatically adapts between `'top-bar'` (Portrait) and `'left-sidebar'` (Horizontal) layouts.
 */
export class HeaderBarControl extends ControlNode<
  HeaderBarControlProps,
  HeaderBarControlState
> {
  private readonly brandBadgeControl: BadgeControl;
  private readonly gamepadBadgeControl: BadgeControl;
  private readonly scoreGroupControl: ScoreCardGroupControl;

  constructor(id: string, props: HeaderBarControlProps) {
    super(id, props);
    this.interactive = false;

    this.brandBadgeControl = new BadgeControl(`${id}-brand-badge`, {
      text: props.brandBadge,
      bgColor: () => this.getUI()?.getTheme().panelAlt ?? 'panelAlt',
      borderColor: () => this.getUI()?.getTheme().accent ?? 'accent',
      textColor: () => this.getUI()?.getTheme().accentBright ?? 'accentBright',
    });

    this.gamepadBadgeControl = new BadgeControl(`${id}-gamepad-badge`, {
      text: () =>
        this.state.gamepadConnected
          ? resolveText(this.props.gamepadConnectedLabel)
          : resolveText(this.props.gamepadDisconnectedLabel),
      bgColor: () => {
        const theme = this.getUI()?.getTheme();
        return this.state.gamepadConnected
          ? (theme?.accent ?? 'accent')
          : (theme?.panelAlt ?? 'panelAlt');
      },
      borderColor: () => {
        const theme = this.getUI()?.getTheme();
        return this.state.gamepadConnected
          ? (theme?.accentBright ?? 'accentBright')
          : (theme?.border ?? 'border');
      },
      textColor: () => {
        const theme = this.getUI()?.getTheme();
        return this.state.gamepadConnected
          ? (theme?.textInverse ?? 'textInverse')
          : (theme?.textMuted ?? 'textMuted');
      },
      alignRight: true,
    });

    this.scoreGroupControl = new ScoreCardGroupControl(`${id}-scores`, {
      cards: props.scoreCards,
      direction: 'row',
      gap: 3,
    });

    this.addControls(
      this.brandBadgeControl,
      this.gamepadBadgeControl,
      this.scoreGroupControl
    );
  }

  protected override createInitialState(): HeaderBarControlState {
    return {
      gamepadConnected: this.getInput()?.isGamepadConnected() ?? false,
    };
  }

  protected override onMount(): void {
    const connected = this.getInput()?.isGamepadConnected() ?? false;
    if (connected !== this.state.gamepadConnected) {
      this.setState({ gamepadConnected: connected }, false);
    }
  }

  protected override onControlEvent(event: ControlEvent): boolean {
    if (event.kind === 'GAMEPAD_STATUS') {
      this.setState({ gamepadConnected: event.connected });
    }
    return false;
  }

  protected override onLayout(bounds: VirtualRect): void {
    const ui = this.getUI();
    if (!ui || bounds.width <= 0 || bounds.height <= 0) return;

    const mode = this.props.layoutMode ?? 'top-bar';

    if (mode === 'top-bar') {
      this.brandBadgeControl.show();
      this.gamepadBadgeControl.show();

      const topRowY = bounds.y + 4;
      const titleScale = Math.max(1, Math.min(1.6, bounds.height / 46));
      const titleText = resolveText(this.props.brandTitle);
      const titleM = ui
        .getSurface()
        .measureText(titleText, titleScale, undefined, ui.getHeadingFont());

      this.brandBadgeControl.setProps(
        { scale: Math.max(0.75, titleScale * 0.7) },
        false
      );
      this.brandBadgeControl.setBounds({
        x: bounds.x + 6 + titleM.width + 4,
        y: topRowY + Math.max(0, Math.floor((titleM.height - 9) / 2)),
        width: 40,
        height: 12,
      });

      this.gamepadBadgeControl.setProps(
        { scale: Math.max(0.75, Math.min(1.05, titleScale * 0.72)) },
        false
      );
      this.gamepadBadgeControl.setBounds({
        x: bounds.x + bounds.width - 5,
        y: topRowY,
        width: 50,
        height: 12,
      });

      const cardsY = topRowY + titleM.height + 5;
      const cardsH = Math.max(22, bounds.height - (cardsY - bounds.y) - 4);
      this.scoreGroupControl.setProps({ direction: 'row', gap: 3 }, false);
      this.scoreGroupControl.setBounds({
        x: bounds.x + 5,
        y: cardsY,
        width: bounds.width - 10,
        height: cardsH,
      });
    } else {
      // Left sidebar layout (Horizontal mode)
      this.brandBadgeControl.hide();
      this.gamepadBadgeControl.hide();

      const startY = bounds.y + 22;
      const availCardsH = bounds.height - 26;
      this.scoreGroupControl.setProps({ direction: 'column', gap: 4 }, false);
      this.scoreGroupControl.setBounds({
        x: bounds.x + 4,
        y: startY,
        width: bounds.width - 8,
        height: availCardsH,
      });
    }
  }

  protected override onRender(
    _surface: IVirtualSurface,
    bounds: VirtualRect
  ): void {
    const ui = this.getUI();
    if (!ui || bounds.width <= 0 || bounds.height <= 0) return;

    const theme = ui.getTheme();
    ui.drawPanel(bounds, {
      bgColor: theme.panelBg,
      borderColor: theme.border,
      radius: 3,
    });

    const mode = this.props.layoutMode ?? 'top-bar';
    const titleText = resolveText(this.props.brandTitle);

    if (mode === 'top-bar') {
      const topRowY = bounds.y + 4;
      const titleScale = Math.max(1, Math.min(1.6, bounds.height / 46));
      ui.drawText(titleText, bounds.x + 6, topRowY, {
        color: theme.accentBright,
        font: ui.getHeadingFont(),
        scale: titleScale,
      });
    } else {
      const centerX = Math.round(bounds.x + bounds.width / 2);
      ui.drawText(titleText, centerX, bounds.y + 6, {
        color: theme.accentBright,
        font: ui.getHeadingFont(),
        scale: 1.15,
        align: 'center',
      });
    }
  }
}

export type ControlDeckLayoutMode = 'bottom-bar' | 'right-sidebar';

export interface ControlDeckControlProps {
  menuLabel: DynamicText;
  pauseLabel: DynamicText;
  restartLabel: DynamicText;
  onDirection?: (direction: ControlDirection) => void;
  onMenuClick: () => void;
  onPauseClick: () => void;
  onRestartClick: () => void;
  layoutMode?: ControlDeckLayoutMode;
}

/**
 * Higher-level HUD Control Deck container in `UIKit.ClassicV1`.
 * Owns a `DPadControl` (which itself manages 4 directional child buttons) and 3 action `ButtonControl`s
 * (`Menu`, `Pause/Resume`, `Restart`).
 * Automatically adapts between `'bottom-bar'` (Portrait) and `'right-sidebar'` (Horizontal) layouts.
 */
export class ControlDeckControl extends ControlNode<ControlDeckControlProps> {
  private readonly dpadControl: DPadControl;
  private readonly menuBtn: ButtonControl;
  private readonly pauseBtn: ButtonControl;
  private readonly restartBtn: ButtonControl;

  constructor(id: string, props: ControlDeckControlProps) {
    super(id, props);
    this.interactive = false;

    this.dpadControl = new DPadControl(`${id}-dpad`, {
      onDirection: props.onDirection,
    });

    this.menuBtn = new ButtonControl(`${id}-btn-menu`, {
      label: props.menuLabel,
      onClick: () => this.props.onMenuClick(),
    });

    this.pauseBtn = new ButtonControl(`${id}-btn-pause`, {
      label: props.pauseLabel,
      onClick: () => this.props.onPauseClick(),
    });

    this.restartBtn = new ButtonControl(`${id}-btn-restart`, {
      label: props.restartLabel,
      onClick: () => this.props.onRestartClick(),
    });

    this.addControls(
      this.dpadControl,
      this.menuBtn,
      this.pauseBtn,
      this.restartBtn
    );
  }

  protected override onLayout(bounds: VirtualRect): void {
    if (bounds.width <= 0 || bounds.height <= 0) return;

    const mode = this.props.layoutMode ?? 'bottom-bar';

    if (mode === 'bottom-bar') {
      const innerPad = 4;
      const ctrlH = bounds.height - innerPad * 2;
      const dpadW = Math.min(
        Math.round(bounds.width * 0.36),
        Math.max(66, Math.round(ctrlH * 1.9))
      );

      this.dpadControl.setBounds({
        x: bounds.x + innerPad + 2,
        y: bounds.y + innerPad,
        width: dpadW,
        height: ctrlH,
      });

      const actionsAreaX = bounds.x + innerPad + dpadW + 8;
      const actionsAreaW = bounds.x + bounds.width - innerPad - actionsAreaX;
      const btnGap = 3;
      const btnW = Math.floor((actionsAreaW - btnGap * 2) / 3);
      const btnH = Math.max(18, Math.min(28, Math.round(ctrlH * 0.72)));
      const btnY = Math.round(bounds.y + (bounds.height - btnH) / 2);

      this.menuBtn.setBounds({
        x: actionsAreaX,
        y: btnY,
        width: btnW,
        height: btnH,
      });
      this.pauseBtn.setBounds({
        x: actionsAreaX + btnW + btnGap,
        y: btnY,
        width: btnW,
        height: btnH,
      });
      this.restartBtn.setBounds({
        x: actionsAreaX + (btnW + btnGap) * 2,
        y: btnY,
        width: btnW,
        height: btnH,
      });
    } else {
      // Right sidebar layout (Horizontal mode)
      const dpadH = Math.min(54, Math.round(bounds.height * 0.3));
      this.dpadControl.setBounds({
        x: bounds.x + 4,
        y: bounds.y + 6,
        width: bounds.width - 8,
        height: dpadH,
      });

      const btnsStartY = bounds.y + dpadH + 14;
      const btnsAvailH = bounds.height - dpadH - 20;
      const btnGap = 4;
      const btnH = Math.min(28, Math.floor((btnsAvailH - btnGap * 2) / 3));

      this.menuBtn.setBounds({
        x: bounds.x + 4,
        y: btnsStartY,
        width: bounds.width - 8,
        height: btnH,
      });
      this.pauseBtn.setBounds({
        x: bounds.x + 4,
        y: btnsStartY + btnH + btnGap,
        width: bounds.width - 8,
        height: btnH,
      });
      this.restartBtn.setBounds({
        x: bounds.x + 4,
        y: btnsStartY + (btnH + btnGap) * 2,
        width: bounds.width - 8,
        height: btnH,
      });
    }
  }

  protected override onRender(
    _surface: IVirtualSurface,
    bounds: VirtualRect
  ): void {
    const ui = this.getUI();
    if (!ui || bounds.width <= 0 || bounds.height <= 0) return;

    const theme = ui.getTheme();
    ui.drawPanel(bounds, {
      bgColor: theme.panelBg,
      borderColor: theme.border,
      radius: 3,
    });
  }
}
