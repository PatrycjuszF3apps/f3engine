import { VirtualRect } from './VirtualSurface';
import { VirtualUIDecorator } from './VirtualUIDecorator';

export interface OverlayPromptConfig {
  /** Optional target bounding rectangle on the virtual pixel grid */
  bounds?: VirtualRect;
  title: string;
  message?: string;
  promptText: string;
  /** Invoked when any key is pressed or the viewport is clicked */
  onConfirm: (trigger: KeyboardEvent | MouseEvent | CustomEvent) => void;
}

const IGNORED_MODIFIER_KEYS = new Set([
  'ShiftLeft',
  'ShiftRight',
  'ControlLeft',
  'ControlRight',
  'AltLeft',
  'AltRight',
  'MetaLeft',
  'MetaRight',
  'CapsLock',
  'Tab',
]);

/**
 * Reusable engine overlay manager for "Press any key when ready" prompts,
 * rendered entirely onto the virtual pixel grid via VirtualUIDecorator.
 */
export class OverlayManager {
  private readonly ui: VirtualUIDecorator;
  private activeConfig: OverlayPromptConfig | null = null;
  private cleanupListeners: (() => void) | null = null;
  private readyForClick = false;

  constructor(ui: VirtualUIDecorator) {
    this.ui = ui;
  }

  public showPrompt(config: OverlayPromptConfig): void {
    this.hide();

    this.activeConfig = config;
    this.readyForClick = false;
    this.ui.getViewport().requestRender();

    const timerId = window.setTimeout(() => {
      this.readyForClick = true;
      const onKeyDown = (event: KeyboardEvent) => {
        if (IGNORED_MODIFIER_KEYS.has(event.code)) return;
        const target = event.target as HTMLElement | null;
        if (target && (target.tagName === 'INPUT' || target.tagName === 'SELECT')) {
          return;
        }
        event.preventDefault();
        event.stopImmediatePropagation();
        this.confirm(event);
      };

      window.addEventListener('keydown', onKeyDown, { capture: true });

      this.cleanupListeners = () => {
        window.removeEventListener('keydown', onKeyDown, { capture: true });
      };
    }, 60);

    this.cleanupListeners = () => {
      window.clearTimeout(timerId);
    };
  }

  public triggerConfirm(
    customTrigger?: KeyboardEvent | MouseEvent | CustomEvent
  ): void {
    if (!this.isVisible()) return;
    this.confirm(customTrigger ?? new CustomEvent('overlayconfirm'));
  }

  public hide(): void {
    if (this.cleanupListeners) {
      this.cleanupListeners();
      this.cleanupListeners = null;
    }
    this.readyForClick = false;
    if (this.activeConfig) {
      this.activeConfig = null;
      this.ui.getViewport().requestRender();
    }
  }

  public isVisible(): boolean {
    return this.activeConfig !== null;
  }

  /**
   * Renders the "Ready to Start" overlay prompt onto the virtual pixel grid.
   */
  public render(bounds?: VirtualRect): void {
    if (!this.activeConfig) return;

    const surface = this.ui.getSurface();
    const theme = this.ui.getTheme();
    const area = bounds ??
      this.activeConfig.bounds ?? {
        x: 0,
        y: 0,
        width: surface.width,
        height: surface.height,
      };

    const uiScale = Math.min(
      this.ui.getViewport().getUIScale(),
      Math.min(area.width / 250, area.height / 240)
    );

    const titleScale = Math.max(0.95, Math.min(1.5, 1.15 * uiScale));
    const msgScale = Math.max(0.75, Math.min(1.15, 0.85 * uiScale));
    const badgeScale = Math.max(0.75, Math.min(1.1, 0.8 * uiScale));

    const boxW = Math.min(area.width - 12, Math.max(170, Math.round(area.width * 0.92)));
    const padX = 8;
    const padY = 6;
    const innerW = boxW - padX * 2;

    const titleH = surface.measureText(this.activeConfig.title, titleScale).height;
    const msgLines = this.activeConfig.message
      ? surface.drawWrappedText(this.activeConfig.message, 0, -1000, innerW, {
          color: theme.textMuted,
          scale: msgScale,
        }).lines
      : 0;
    const msgH = this.activeConfig.message
      ? msgLines * surface.measureText('A', msgScale).height +
        Math.max(0, msgLines - 1) * 2 +
        4
      : 0;

    const promptLines = surface.drawWrappedText(
      this.activeConfig.promptText,
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

    this.ui.drawPanel(
      { x: boxX, y: boxY, width: boxW, height: boxH },
      {
        bgColor: theme.panelBg,
        borderColor: theme.accent,
        shadowColor: theme.bgOuter,
        radius: 3,
      }
    );

    let cursorY = boxY + padY;
    this.ui.drawText(this.activeConfig.title, centerX, cursorY, {
      color: theme.textMain,
      scale: titleScale,
      align: 'center',
    });
    cursorY += titleH + 4;

    if (this.activeConfig.message) {
      const m = this.ui.drawWrappedText(
        this.activeConfig.message,
        centerX,
        cursorY,
        innerW,
        {
          color: theme.textMuted,
          scale: msgScale,
          align: 'center',
          lineHeight: 2,
        }
      );
      cursorY += m.height + 4;
    }

    const badgeRect: VirtualRect = {
      x: boxX + padX,
      y: cursorY,
      width: innerW,
      height: badgeH,
    };

    this.ui.drawPanel(badgeRect, {
      bgColor: theme.panelAlt,
      borderColor: theme.accentBright,
      radius: 2,
    });

    this.ui.drawWrappedText(
      this.activeConfig.promptText,
      centerX,
      badgeRect.y + 4,
      innerW - 8,
      {
        color: theme.accentBright,
        scale: badgeScale,
        align: 'center',
        lineHeight: 2,
      }
    );

    // Entire board/viewport area is clickable to confirm readiness
    this.ui.registerHitRegion({
      id: 'overlay-ready-confirm',
      rect: area,
      layer: 'modal',
      onClick: () => {
        if (this.readyForClick) {
          this.confirm(new CustomEvent('overlayclick'));
        }
      },
    });
  }

  private confirm(trigger: KeyboardEvent | MouseEvent | CustomEvent): void {
    const config = this.activeConfig;
    this.hide();
    if (config) {
      config.onConfirm(trigger);
    }
  }
}
