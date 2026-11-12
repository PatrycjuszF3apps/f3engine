import {
  I18nManager,
  MenuSystem,
  OverlayManager,
  VirtualRect,
  VirtualUIDecorator,
} from '../../../engine';
import { Direction, GameStats, SnakeGame } from './SnakeGame';
import { DIFFICULTY_PRESETS } from './SnakeSettings';
import { StringId, SupportedLocale } from './i18n';

export interface SnakeHUDActions {
  onDirection: (dir: Direction) => void;
  onMenuClick: () => void;
  onPauseClick: () => void;
  onRestartClick: () => void;
}

/**
 * Full-screen compositor for the Snake demo on the virtual pixel grid.
 * Uses VirtualUIDecorator to draw the header, score cards, 20x20 game board,
 * bottom control deck (D-Pad + action buttons), and modal layers (MenuSystem & OverlayManager).
 * Automatically adapts layout to Portrait and Horizontal orientations.
 */
export class SnakeHUDRenderer {
  private readonly ui: VirtualUIDecorator;
  private readonly i18n: I18nManager<SupportedLocale, StringId>;
  private readonly game: SnakeGame;
  private readonly menu: MenuSystem;
  private readonly overlay: OverlayManager;
  private readonly actions: SnakeHUDActions;

  private gamepadConnected = false;

  constructor(
    ui: VirtualUIDecorator,
    i18n: I18nManager<SupportedLocale, StringId>,
    game: SnakeGame,
    menu: MenuSystem,
    overlay: OverlayManager,
    actions: SnakeHUDActions
  ) {
    this.ui = ui;
    this.i18n = i18n;
    this.game = game;
    this.menu = menu;
    this.overlay = overlay;
    this.actions = actions;
  }

  public setGamepadStatus(connected: boolean): void {
    this.gamepadConnected = connected;
  }

  public renderFrame(): void {
    const surface = this.ui.getSurface();
    const theme = this.ui.getTheme();
    const vw = surface.width;
    const vh = surface.height;
    const modalVisible = this.menu.isVisible() || this.overlay.isVisible();

    this.ui.beginFrame(modalVisible);
    surface.clear(theme.bgOuter);

    const stats = this.game.getStats();
    const isHorizontal = vw > vh * 1.12;

    let boardRect: VirtualRect;

    if (isHorizontal) {
      boardRect = this.renderHorizontalLayout(vw, vh, stats);
    } else {
      boardRect = this.renderPortraitLayout(vw, vh, stats);
    }

    // Modal layers (Menu or Ready Prompt) drawn over the board/viewport
    if (this.menu.isVisible()) {
      this.menu.render(boardRect);
    } else if (this.overlay.isVisible()) {
      this.overlay.render(boardRect);
    }

    this.ui.getViewport().present();
  }

  private renderPortraitLayout(
    vw: number,
    vh: number,
    stats: GameStats
  ): VirtualRect {
    const theme = this.ui.getTheme();
    const margin = Math.max(4, Math.round(vw * 0.02));
    const headerH = Math.max(50, Math.min(82, Math.round(vh * 0.145)));
    const footerH = Math.max(46, Math.min(76, Math.round(vh * 0.125)));

    const headerRect: VirtualRect = {
      x: margin,
      y: margin,
      width: vw - margin * 2,
      height: headerH,
    };

    const footerRect: VirtualRect = {
      x: margin,
      y: vh - footerH - margin,
      width: vw - margin * 2,
      height: footerH,
    };

    const boardAvailRect: VirtualRect = {
      x: margin,
      y: headerRect.y + headerRect.height + margin,
      width: vw - margin * 2,
      height:
        footerRect.y - (headerRect.y + headerRect.height) - margin * 2,
    };

    // 1. HUD Header (Title + Gamepad Status + 4 Score Cards)
    this.ui.drawPanel(headerRect, {
      bgColor: theme.panelBg,
      borderColor: theme.border,
      radius: 3,
    });

    const topRowY = headerRect.y + 4;
    const titleScale = Math.max(1, Math.min(1.6, headerH / 46));
    const titleText = this.i18n.t('header.brand_title');
    const titleM = this.ui.drawText(titleText, headerRect.x + 6, topRowY, {
      color: theme.accentBright,
      font: this.ui.getHeadingFont(),
      scale: titleScale,
    });

    this.ui.drawBadge(
      headerRect.x + 6 + titleM.width + 4,
      topRowY + Math.max(0, Math.floor((titleM.height - 9) / 2)),
      this.i18n.t('header.brand_badge'),
      {
        bgColor: theme.panelAlt,
        borderColor: theme.accent,
        textColor: theme.accentBright,
        scale: Math.max(0.75, titleScale * 0.7),
      }
    );

    const padLabel = this.gamepadConnected
      ? this.i18n.t('header.gamepad_connected')
      : this.i18n.t('header.gamepad_disconnected');
    this.ui.drawBadge(
      headerRect.x + headerRect.width - 5,
      topRowY,
      padLabel,
      {
        bgColor: this.gamepadConnected ? theme.accent : theme.panelAlt,
        borderColor: this.gamepadConnected ? theme.accentBright : theme.border,
        textColor: this.gamepadConnected ? theme.textInverse : theme.textMuted,
        scale: Math.max(0.75, Math.min(1.05, titleScale * 0.72)),
        alignRight: true,
      }
    );

    // 4 Score Cards
    const cardsY = topRowY + titleM.height + 5;
    const cardsH = Math.max(22, headerRect.height - (cardsY - headerRect.y) - 4);
    const cardGap = 3;
    const cardsTotalW = headerRect.width - 10;
    const cardW = Math.floor((cardsTotalW - cardGap * 3) / 4);

    const preset =
      DIFFICULTY_PRESETS[stats.difficulty] ?? DIFFICULTY_PRESETS.medium;
    const diffLabel = this.i18n.t(preset.labelId).toUpperCase();

    const cards: Array<{ label: string; value: string; accent?: boolean }> = [
      {
        label: this.i18n.t('scoreboard.difficulty'),
        value: diffLabel,
        accent: true,
      },
      {
        label: this.i18n.t('scoreboard.score'),
        value: String(stats.score),
      },
      {
        label: this.i18n.t('scoreboard.high_score'),
        value: String(stats.highScore),
      },
      {
        label: this.i18n.t('scoreboard.speed'),
        value: stats.speedMultiplier,
      },
    ];

    cards.forEach((c, idx) => {
      this.ui.drawScoreCard(
        {
          x: headerRect.x + 5 + idx * (cardW + cardGap),
          y: cardsY,
          width: cardW,
          height: cardsH,
        },
        c.label,
        c.value,
        c.accent
      );
    });

    // 2. 20x20 Game Board
    const actualBoardRect = this.game.renderBoard(
      this.ui.getSurface(),
      boardAvailRect
    );

    // 3. Bottom Control Deck (D-Pad + Action Buttons)
    this.ui.drawPanel(footerRect, {
      bgColor: theme.panelBg,
      borderColor: theme.border,
      radius: 3,
    });

    const innerPad = 4;
    const ctrlH = footerRect.height - innerPad * 2;
    const dpadW = Math.min(
      Math.round(footerRect.width * 0.36),
      Math.max(66, Math.round(ctrlH * 1.9))
    );

    this.ui.drawDpad(
      {
        x: footerRect.x + innerPad + 2,
        y: footerRect.y + innerPad,
        width: dpadW,
        height: ctrlH,
      },
      (dir) => this.actions.onDirection(dir)
    );

    const actionsAreaX = footerRect.x + innerPad + dpadW + 8;
    const actionsAreaW =
      footerRect.x + footerRect.width - innerPad - actionsAreaX;
    const btnGap = 3;
    const btnW = Math.floor((actionsAreaW - btnGap * 2) / 3);
    const btnH = Math.max(18, Math.min(28, Math.round(ctrlH * 0.72)));
    const btnY = Math.round(footerRect.y + (footerRect.height - btnH) / 2);

    const pauseLabel =
      stats.status === 'PAUSED'
        ? this.i18n.t('controls.resume_btn')
        : this.i18n.t('controls.pause_btn');

    this.ui.drawButton(
      'hud-btn-menu',
      { x: actionsAreaX, y: btnY, width: btnW, height: btnH },
      this.i18n.t('controls.menu_btn'),
      () => this.actions.onMenuClick()
    );
    this.ui.drawButton(
      'hud-btn-pause',
      {
        x: actionsAreaX + btnW + btnGap,
        y: btnY,
        width: btnW,
        height: btnH,
      },
      pauseLabel,
      () => this.actions.onPauseClick()
    );
    this.ui.drawButton(
      'hud-btn-restart',
      {
        x: actionsAreaX + (btnW + btnGap) * 2,
        y: btnY,
        width: btnW,
        height: btnH,
      },
      this.i18n.t('controls.restart_btn'),
      () => this.actions.onRestartClick()
    );

    return actualBoardRect;
  }

  private renderHorizontalLayout(
    vw: number,
    vh: number,
    stats: GameStats
  ): VirtualRect {
    const theme = this.ui.getTheme();
    const margin = Math.max(4, Math.round(vh * 0.02));
    const maxBoardSpace = vh - margin * 2;
    const sideW = Math.max(
      62,
      Math.floor((vw - maxBoardSpace - margin * 4) / 2)
    );

    const leftPanel: VirtualRect = {
      x: margin,
      y: margin,
      width: sideW,
      height: vh - margin * 2,
    };

    const rightPanel: VirtualRect = {
      x: vw - sideW - margin,
      y: margin,
      width: sideW,
      height: vh - margin * 2,
    };

    const centerArea: VirtualRect = {
      x: leftPanel.x + leftPanel.width + margin,
      y: margin,
      width: rightPanel.x - (leftPanel.x + leftPanel.width) - margin * 2,
      height: vh - margin * 2,
    };

    // Left Panel: Title + Vertical Score Cards
    this.ui.drawPanel(leftPanel, {
      bgColor: theme.panelBg,
      borderColor: theme.border,
      radius: 3,
    });

    const centerXLeft = Math.round(leftPanel.x + leftPanel.width / 2);
    this.ui.drawText(
      this.i18n.t('header.brand_title'),
      centerXLeft,
      leftPanel.y + 6,
      {
        color: theme.accentBright,
        font: this.ui.getHeadingFont(),
        scale: 1.15,
        align: 'center',
      }
    );

    const preset =
      DIFFICULTY_PRESETS[stats.difficulty] ?? DIFFICULTY_PRESETS.medium;
    const diffLabel = this.i18n.t(preset.labelId).toUpperCase();

    const cards = [
      {
        label: this.i18n.t('scoreboard.difficulty'),
        value: diffLabel,
        accent: true,
      },
      {
        label: this.i18n.t('scoreboard.score'),
        value: String(stats.score),
      },
      {
        label: this.i18n.t('scoreboard.high_score'),
        value: String(stats.highScore),
      },
      {
        label: this.i18n.t('scoreboard.speed'),
        value: stats.speedMultiplier,
      },
    ];

    const startY = leftPanel.y + 22;
    const availCardsH = leftPanel.height - 26;
    const cardGap = 4;
    const cardH = Math.floor((availCardsH - cardGap * 3) / 4);

    cards.forEach((c, idx) => {
      this.ui.drawScoreCard(
        {
          x: leftPanel.x + 4,
          y: startY + idx * (cardH + cardGap),
          width: leftPanel.width - 8,
          height: cardH,
        },
        c.label,
        c.value,
        c.accent
      );
    });

    // Center: 20x20 Game Board
    const actualBoardRect = this.game.renderBoard(
      this.ui.getSurface(),
      centerArea
    );

    // Right Panel: D-Pad + Action Buttons
    this.ui.drawPanel(rightPanel, {
      bgColor: theme.panelBg,
      borderColor: theme.border,
      radius: 3,
    });

    const dpadH = Math.min(54, Math.round(rightPanel.height * 0.3));
    this.ui.drawDpad(
      {
        x: rightPanel.x + 4,
        y: rightPanel.y + 6,
        width: rightPanel.width - 8,
        height: dpadH,
      },
      (dir) => this.actions.onDirection(dir)
    );

    const btnsStartY = rightPanel.y + dpadH + 14;
    const btnsAvailH = rightPanel.height - dpadH - 20;
    const btnGap = 4;
    const btnH = Math.min(28, Math.floor((btnsAvailH - btnGap * 2) / 3));

    const pauseLabel =
      stats.status === 'PAUSED'
        ? this.i18n.t('controls.resume_btn')
        : this.i18n.t('controls.pause_btn');

    this.ui.drawButton(
      'hud-btn-menu',
      {
        x: rightPanel.x + 4,
        y: btnsStartY,
        width: rightPanel.width - 8,
        height: btnH,
      },
      this.i18n.t('controls.menu_btn'),
      () => this.actions.onMenuClick()
    );
    this.ui.drawButton(
      'hud-btn-pause',
      {
        x: rightPanel.x + 4,
        y: btnsStartY + btnH + btnGap,
        width: rightPanel.width - 8,
        height: btnH,
      },
      pauseLabel,
      () => this.actions.onPauseClick()
    );
    this.ui.drawButton(
      'hud-btn-restart',
      {
        x: rightPanel.x + 4,
        y: btnsStartY + (btnH + btnGap) * 2,
        width: rightPanel.width - 8,
        height: btnH,
      },
      this.i18n.t('controls.restart_btn'),
      () => this.actions.onRestartClick()
    );

    return actualBoardRect;
  }
}
