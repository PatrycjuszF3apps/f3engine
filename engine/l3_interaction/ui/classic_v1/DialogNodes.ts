import {
  ControlDirection,
  ControlEvent,
} from '../../../l2_runtime/input/ControlEvents';
import { ControlNode } from '../../../l2_runtime/nodes/ControlNode';
import { IVirtualSurface, VirtualRect } from '../../../l1_infrastructure/VirtualSurface';
import { DynamicText, resolveText } from './BasicControls';
import {
  MenuChoiceOptionDescriptor,
  MenuItemDescriptor,
  MenuListControl,
} from './MenuControls';

export interface ModalDialogProps {
  title: DynamicText;
  subtitle?: DynamicText;
  items: MenuItemDescriptor[];
  footerHint?: DynamicText;
  onBack?: () => void;
  drawBackdrop?: boolean;
}

export interface ModalDialogState {
  hasOpenSubDialog: boolean;
}

interface ComputedDialogMetrics {
  bigMode: boolean;
  titleScale: number;
  subScale: number;
  hintScale: number;
  padX: number;
  padY: number;
  boxX: number;
  boxY: number;
  boxW: number;
  boxH: number;
  innerW: number;
  titleH: number;
  subH: number;
  headerGap: number;
  itemsTotalH: number;
  hintH: number;
}

/**
 * Higher-level modal dialog container node (`Form` / `Window`) in `UIKit.ClassicV1`.
 *
 * Features:
 * - Owns and orchestrates an internal `MenuListControl` child that manages item states and navigation.
 * - Acts as a `modal = true` input barrier shielding background nodes.
 * - Supports cascading child dialogs (`openSubDialog(childDialog)`): opening a child dialog (such as `SettingsDialogNode`)
 *   automatically suspends this parent dialog, and closing the child dialog restores the parent dialog's state and focus.
 *   Closing or hiding the parent dialog cascades and closes all child dialogs in a single call.
 */
export class ModalDialogNode<
  TProps extends ModalDialogProps = ModalDialogProps,
> extends ControlNode<TProps, ModalDialogState> {
  protected readonly menuList: MenuListControl;
  private activeSubDialog: ModalDialogNode | null = null;
  private closeCallback: (() => void) | null = null;
  private lastMetrics: ComputedDialogMetrics | null = null;

  constructor(id: string, props: TProps) {
    super(id, props);
    this.modal = true;
    this.interactive = false;

    this.menuList = new MenuListControl(`${id}-list`, {
      items: props.items,
    });
    this.addChild(this.menuList);
  }

  protected override createInitialState(): ModalDialogState {
    return {
      hasOpenSubDialog: false,
    };
  }

  public getMenuList(): MenuListControl {
    return this.menuList;
  }

  public setItems(
    items: MenuItemDescriptor[],
    preserveSelection = true
  ): this {
    this.props = { ...this.props, items };
    this.menuList.setItems(items, preserveSelection);
    return this;
  }

  /**
   * Opens this dialog (enables and makes it visible), optionally resetting selection to `initialIndex`.
   */
  public open(initialIndex?: number, onClose?: () => void): this {
    this.closeSubDialog();
    if (onClose !== undefined) {
      this.closeCallback = onClose;
    }
    this.menuList.enable();
    if (initialIndex !== undefined) {
      this.menuList.setSelectedIndex(initialIndex);
    }
    this.enable();
    return this;
  }

  /**
   * Closes this dialog and cascades closure to any open child sub-dialogs.
   */
  public close(): this {
    this.closeSubDialog();
    this.disable();
    const cb = this.closeCallback;
    this.closeCallback = null;
    cb?.();
    return this;
  }

  /**
   * Opens a cascading child dialog (e.g. `SettingsDialogNode`) on top of this dialog.
   * Automatically suspends this dialog's own `menuList` while preserving its `selectedIndex`,
   * and restores this dialog when the child dialog closes.
   */
  public openSubDialog(
    subDialog: ModalDialogNode,
    initialIndex = 0
  ): this {
    if (this.activeSubDialog && this.activeSubDialog !== subDialog) {
      this.activeSubDialog.disable();
    }

    if (subDialog.parent !== this) {
      this.addChild(subDialog);
    }

    this.activeSubDialog = subDialog;
    this.menuList.disable();
    this.setState({ hasOpenSubDialog: true }, false);

    subDialog.open(initialIndex, () => {
      if (this.activeSubDialog === subDialog) {
        this.activeSubDialog = null;
        this.setState({ hasOpenSubDialog: false }, false);
        if (this.visible && this.enabled) {
          this.menuList.enable();
        }
        this.requestRender();
      }
    });

    this.requestRender();
    return this;
  }

  /**
   * Closes any active cascading sub-dialog and restores this dialog's menu list.
   */
  public closeSubDialog(): this {
    if (!this.activeSubDialog) return this;
    const sub = this.activeSubDialog;
    this.activeSubDialog = null;
    this.setState({ hasOpenSubDialog: false }, false);
    sub.disable();
    if (this.visible && this.enabled) {
      this.menuList.enable();
    }
    this.requestRender();
    return this;
  }

  protected override onDisable(): void {
    super.onDisable();
    if (this.activeSubDialog) {
      this.activeSubDialog.disable();
      this.activeSubDialog = null;
      this.state.hasOpenSubDialog = false;
    }
  }

  protected override onResetState(): void {
    this.closeSubDialog();
  }

  protected override onControlEvent(event: ControlEvent): boolean {
    if (this.activeSubDialog && this.activeSubDialog.visible) {
      return false;
    }

    if (event.kind === 'ACTION' && event.action === 'CANCEL') {
      if (this.props.onBack) {
        this.props.onBack();
        return true;
      }
      if (this.closeCallback) {
        this.close();
        return true;
      }
    }

    return false;
  }

  protected override onLayout(bounds: VirtualRect): void {
    if (bounds.width <= 0 || bounds.height <= 0) return;

    if (this.activeSubDialog && this.activeSubDialog.visible) {
      this.activeSubDialog.setBounds(bounds);
      return;
    }

    const metrics = this.computeMetrics(bounds);
    this.lastMetrics = metrics;
    if (!metrics) return;

    const listY =
      metrics.boxY +
      metrics.padY +
      metrics.titleH +
      3 +
      metrics.subH +
      metrics.headerGap;

    this.menuList.setProps({ bigMode: metrics.bigMode }, false);
    this.menuList.setBounds({
      x: metrics.boxX + metrics.padX,
      y: listY,
      width: metrics.innerW,
      height: metrics.itemsTotalH,
    });
  }

  protected override onRender(
    _surface: IVirtualSurface,
    bounds: VirtualRect
  ): void {
    if (this.activeSubDialog && this.activeSubDialog.visible) {
      return;
    }

    const ui = this.getUI();
    if (!ui || bounds.width <= 0 || bounds.height <= 0) return;

    const metrics = this.lastMetrics ?? this.computeMetrics(bounds);
    if (!metrics) return;

    const theme = ui.getTheme();
    const headingFont = ui.getHeadingFont();

    if (this.props.drawBackdrop !== false) {
      ui.drawModalBackdrop(bounds);
    }

    ui.drawPanel(
      {
        x: metrics.boxX,
        y: metrics.boxY,
        width: metrics.boxW,
        height: metrics.boxH,
      },
      {
        bgColor: theme.panelBg,
        borderColor: theme.borderHighlight,
        shadowColor: theme.bgOuter,
        radius: 3,
      }
    );

    const centerX = Math.round(metrics.boxX + metrics.boxW / 2);
    let cursorY = metrics.boxY + metrics.padY;

    const title = resolveText(this.props.title);
    ui.drawText(title, centerX, cursorY, {
      color: theme.accentBright,
      font: headingFont,
      scale: metrics.titleScale,
      align: 'center',
    });
    cursorY += metrics.titleH + 3;

    const subtitle = this.props.subtitle
      ? resolveText(this.props.subtitle)
      : '';
    if (subtitle) {
      const wrapped = ui.drawWrappedText(
        subtitle,
        centerX,
        cursorY,
        metrics.innerW,
        {
          color: theme.textMuted,
          scale: metrics.subScale,
          align: 'center',
          lineHeight: 2,
        }
      );
      cursorY += wrapped.height;
    }

    const footerHint = this.props.footerHint
      ? resolveText(this.props.footerHint)
      : '';
    if (footerHint) {
      const hintY = metrics.boxY + metrics.boxH - metrics.hintH + 2;
      ui.drawWrappedText(footerHint, centerX, hintY, metrics.innerW, {
        color: theme.textMuted,
        scale: metrics.hintScale,
        align: 'center',
        lineHeight: 2,
      });
    }
  }

  private computeMetrics(area: VirtualRect): ComputedDialogMetrics | null {
    const ui = this.getUI();
    if (!ui) return null;

    const surface = ui.getSurface();
    const theme = ui.getTheme();
    const rawScale = ui.getViewport().getUIScale();
    const bigMode =
      rawScale >= 1.6 && area.width >= 380 && area.height >= 360;

    const headingFont = ui.getHeadingFont();
    const candidateTitleScale = bigMode ? 2 : 1;
    const subScale = 1;
    const hintScale = 1;

    const padX = bigMode ? 12 : 8;
    const padY = bigMode ? 10 : 7;
    const boxW = Math.min(
      area.width - 8,
      Math.max(180, Math.round(area.width * 0.94))
    );
    const innerW = boxW - padX * 2;

    const title = resolveText(this.props.title);
    const subtitle = this.props.subtitle
      ? resolveText(this.props.subtitle)
      : '';
    const footerHint = this.props.footerHint
      ? resolveText(this.props.footerHint)
      : '';

    const titleAtCandidate = surface.measureText(
      title,
      candidateTitleScale,
      undefined,
      headingFont
    );
    const titleScale =
      titleAtCandidate.width > innerW ? 1 : candidateTitleScale;
    const titleH = surface.measureText(
      title,
      titleScale,
      undefined,
      headingFont
    ).height;

    const subLines = subtitle
      ? surface.drawWrappedText(subtitle, 0, -1000, innerW, {
          color: theme.textMuted,
          scale: subScale,
        }).lines
      : 0;
    const subH = subtitle
      ? subLines * surface.measureText('A', subScale).height +
        Math.max(0, subLines - 1) * 2 +
        3
      : 0;

    const itemsTotalH = this.menuList.measureTotalHeight(bigMode);

    const hintLines = footerHint
      ? surface.drawWrappedText(footerHint, 0, -1000, innerW, {
          color: theme.textMuted,
          scale: hintScale,
        }).lines
      : 0;
    const hintH = footerHint
      ? hintLines * surface.measureText('A', hintScale).height +
        Math.max(0, hintLines - 1) * 2 +
        5
      : 0;

    const headerGap = bigMode ? 7 : 5;
    const boxH = Math.min(
      area.height - 8,
      padY * 2 + titleH + subH + headerGap + itemsTotalH + hintH
    );
    const boxX = Math.round(area.x + (area.width - boxW) / 2);
    const boxY = Math.round(area.y + (area.height - boxH) / 2);

    return {
      bigMode,
      titleScale,
      subScale,
      hintScale,
      padX,
      padY,
      boxX,
      boxY,
      boxW,
      boxH,
      innerW,
      titleH,
      subH,
      headerGap,
      itemsTotalH,
      hintH,
    };
  }
}

export interface SettingsChoiceDescriptor {
  id: string;
  label: DynamicText;
  options: MenuChoiceOptionDescriptor<string>[];
  getValue: () => string;
  onChange: (newValue: string) => void;
}

export interface SettingsDialogProps {
  title: DynamicText;
  subtitle?: DynamicText;
  choices: SettingsChoiceDescriptor[];
  backLabel: DynamicText;
  footerHint?: DynamicText;
  onClose?: () => void;
}

/**
 * Out-of-the-box Settings modal dialog node in `UIKit.ClassicV1`.
 * Automatically builds `MenuChoiceItemControl` rows for each setting descriptor
 * plus a `Back` action item, and closes back to its parent dialog on `Back` or `CANCEL`.
 */
export class SettingsDialogNode extends ModalDialogNode {
  constructor(id: string, settingsProps: SettingsDialogProps) {
    const handleBack = () => {
      this.close();
      settingsProps.onClose?.();
    };

    const items: MenuItemDescriptor[] = [
      ...settingsProps.choices.map((c) => ({
        id: c.id,
        type: 'choice' as const,
        label: c.label,
        options: c.options,
        getValue: c.getValue,
        onChange: c.onChange,
      })),
      {
        id: 'back',
        type: 'action' as const,
        label: settingsProps.backLabel,
        onSelect: handleBack,
      },
    ];

    super(id, {
      title: settingsProps.title,
      subtitle: settingsProps.subtitle,
      items,
      footerHint: settingsProps.footerHint,
      onBack: handleBack,
    });
  }
}

export interface ReadyPromptDialogProps {
  title: DynamicText;
  message?: DynamicText;
  promptText: DynamicText;
  onConfirm: (initialDirection?: ControlDirection) => void;
  onCancel?: () => void;
}

export interface ReadyPromptDialogState {
  openedAtMs: number;
}

/**
 * Higher-level readiness overlay dialog node ("Press any key or click when ready")
 * in the `UIKit.ClassicV1` namespace.
 * Intercepts normalized direction, action, raw key, or pointer click events,
 * forwarding an optional initial `ControlDirection` if confirmed via directional input.
 */
export class ReadyPromptDialogNode extends ControlNode<
  ReadyPromptDialogProps,
  ReadyPromptDialogState
> {
  private static readonly ACTIVATION_GUARD_MS = 55;

  constructor(id: string, props: ReadyPromptDialogProps) {
    super(id, props);
    this.modal = true;
    this.interactive = true;
    this.cursor = 'pointer';
    this.disable();
  }

  protected override createInitialState(): ReadyPromptDialogState {
    return { openedAtMs: 0 };
  }

  public showPrompt(overrideProps?: Partial<ReadyPromptDialogProps>): this {
    if (overrideProps) {
      this.setProps(overrideProps, false);
    }
    this.setState({ openedAtMs: performance.now() }, false);
    this.enable();
    return this;
  }

  protected override onEnable(): void {
    this.setState({ openedAtMs: performance.now() }, false);
  }

  protected override onClick(): void {
    if (!this.isReadyForTrigger()) return;
    this.confirmWith(undefined);
  }

  protected override onControlEvent(event: ControlEvent): boolean {
    if (!this.isReadyForTrigger()) {
      event.consume();
      return true;
    }

    if (event.kind === 'ACTION') {
      if (event.action === 'CANCEL') {
        this.disable();
        this.props.onCancel?.();
        return true;
      }
      this.confirmWith(undefined);
      return true;
    }

    if (event.kind === 'DIRECTION' && event.phase === 'pressed') {
      this.confirmWith(event.direction);
      return true;
    }

    if (event.kind === 'RAW_KEY' && event.phase === 'down') {
      if (event.code === 'Escape') {
        this.disable();
        this.props.onCancel?.();
        return true;
      }
      const mappedDir = this.getInput()
        ? undefined
        : undefined;
      void mappedDir;
      // Let directional keys or Escape be handled by their normalized events if mapped,
      // or confirm directly for any other key (e.g. letter/number keys).
      if (
        event.code === 'ArrowUp' ||
        event.code === 'ArrowDown' ||
        event.code === 'ArrowLeft' ||
        event.code === 'ArrowRight' ||
        event.code === 'KeyW' ||
        event.code === 'KeyS' ||
        event.code === 'KeyA' ||
        event.code === 'KeyD'
      ) {
        return false;
      }
      this.confirmWith(undefined);
      return true;
    }

    return false;
  }

  protected override onRender(
    surface: IVirtualSurface,
    area: VirtualRect
  ): void {
    const ui = this.getUI();
    if (!ui || area.width <= 0 || area.height <= 0) return;

    const theme = ui.getTheme();
    const uiScale = Math.min(
      ui.getViewport().getUIScale(),
      Math.min(area.width / 250, area.height / 240)
    );

    const headingFont = ui.getHeadingFont();
    const titleScale = Math.max(0.95, Math.min(1.5, 1.15 * uiScale));
    const msgScale = Math.max(0.75, Math.min(1.15, 0.85 * uiScale));
    const badgeScale = Math.max(0.75, Math.min(1.1, 0.8 * uiScale));

    const boxW = Math.min(
      area.width - 12,
      Math.max(170, Math.round(area.width * 0.92))
    );
    const padX = 8;
    const padY = 6;
    const innerW = boxW - padX * 2;

    const title = resolveText(this.props.title);
    const message = this.props.message ? resolveText(this.props.message) : '';
    const promptText = resolveText(this.props.promptText);

    const titleH = surface.measureText(
      title,
      titleScale,
      undefined,
      headingFont
    ).height;
    const msgLines = message
      ? surface.drawWrappedText(message, 0, -1000, innerW, {
          color: theme.textMuted,
          scale: msgScale,
        }).lines
      : 0;
    const msgH = message
      ? msgLines * surface.measureText('A', msgScale).height +
        Math.max(0, msgLines - 1) * 2 +
        4
      : 0;

    const promptLines = surface.drawWrappedText(
      promptText,
      0,
      -1000,
      innerW - 8,
      {
        color: theme.accentBright,
        scale: badgeScale,
      }
    ).lines;
    const badgeH =
      promptLines * surface.measureText('A', badgeScale).height +
      Math.max(0, promptLines - 1) * 2 +
      8;

    const boxH = Math.min(
      area.height - 10,
      padY * 2 + titleH + 4 + msgH + badgeH
    );
    const boxX = Math.round(area.x + (area.width - boxW) / 2);
    const boxY = Math.round(area.y + area.height - boxH - 8);
    const centerX = Math.round(boxX + boxW / 2);

    ui.drawPanel(
      { x: boxX, y: boxY, width: boxW, height: boxH },
      {
        bgColor: theme.panelBg,
        borderColor: theme.accent,
        shadowColor: theme.bgOuter,
        radius: 3,
      }
    );

    let cursorY = boxY + padY;
    ui.drawText(title, centerX, cursorY, {
      color: theme.textMain,
      font: headingFont,
      scale: titleScale,
      align: 'center',
    });
    cursorY += titleH + 4;

    if (message) {
      const m = ui.drawWrappedText(message, centerX, cursorY, innerW, {
        color: theme.textMuted,
        scale: msgScale,
        align: 'center',
        lineHeight: 2,
      });
      cursorY += m.height + 4;
    }

    const badgeRect: VirtualRect = {
      x: boxX + padX,
      y: cursorY,
      width: innerW,
      height: badgeH,
    };

    ui.drawPanel(badgeRect, {
      bgColor: theme.panelAlt,
      borderColor: theme.accentBright,
      radius: 2,
    });

    ui.drawWrappedText(promptText, centerX, badgeRect.y + 4, innerW - 8, {
      color: theme.accentBright,
      scale: badgeScale,
      align: 'center',
      lineHeight: 2,
    });
  }

  private isReadyForTrigger(): boolean {
    return (
      performance.now() - this.state.openedAtMs >=
      ReadyPromptDialogNode.ACTIVATION_GUARD_MS
    );
  }

  private confirmWith(initialDirection?: ControlDirection): void {
    this.disable();
    this.props.onConfirm(initialDirection);
  }
}
