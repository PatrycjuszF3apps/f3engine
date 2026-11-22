import {
  AppRootConfig,
  AppRootNode,
  I18nManager,
  StorageStore,
  UIKit,
  VideoFilterManager,
  VideoFilterType,
} from '../../../../engine';
import { SnakePersistedState } from '../l1_infrastructure/SnakeSettingsRepository';
import { SnakeSettingsRepositoryRegistrar } from '../l1_infrastructure/SnakeSettingsRepository.registrar';
import {
  StringId,
  SupportedLocale,
} from '../l3_interaction/SnakeI18nService';
import { SnakeI18nServiceRegistrar } from '../l3_interaction/SnakeI18nService.registrar';
import {
  DIFFICULTY_PRESETS,
  Difficulty,
  Direction,
  GameStats,
  SNAKE_L4_TOKENS,
} from '../l4_domain/SnakeSimulationService';
import { SnakeSimulationServiceRegistrar } from '../l4_domain/SnakeSimulationService.registrar';
import { SnakeBoardNode, SnakeBoardProps } from './SnakeBoardNode';

export interface SnakeAppRootProps {
  store: StorageStore<SnakePersistedState>;
  i18n: I18nManager<SupportedLocale, StringId>;
  filterManager: VideoFilterManager;
}

export interface SnakeAppRootState {
  lastGameOverStats: GameStats | null;
  readyMode: 'new' | 'resume';
}

/**
 * Top-level Snake application root node in `l2_runtime/` wiring the 4-layer DDD service registrars:
 * - `l1_infrastructure`: `SnakeSettingsRepositoryRegistrar`
 * - `l3_interaction`: `SnakeI18nServiceRegistrar`
 * - `l4_domain`: `SnakeSimulationServiceRegistrar`
 */
export class SnakeAppRootNode extends AppRootNode<
  SnakeAppRootProps,
  SnakeAppRootState
> {
  public readonly boardNode: SnakeBoardNode;
  public readonly shellNode: UIKit.ClassicV1.ResponsiveAppShellNode;
  public readonly titleDialog: UIKit.ClassicV1.ModalDialogNode;
  public readonly pauseDialog: UIKit.ClassicV1.ModalDialogNode;
  public readonly gameOverDialog: UIKit.ClassicV1.ModalDialogNode;
  public readonly settingsDialog: UIKit.ClassicV1.SettingsDialogNode;
  public readonly readyDialog: UIKit.ClassicV1.ReadyPromptDialogNode;

  private readonly unsubStore: () => void;
  private readonly unsubI18n: () => void;

  constructor(config: AppRootConfig, props: SnakeAppRootProps) {
    super(
      {
        ...config,
        registrars: {
          l1_infrastructure: [
            new SnakeSettingsRepositoryRegistrar(props.store),
            ...(config.registrars?.l1_infrastructure ?? []),
          ],
          l2_runtime: [...(config.registrars?.l2_runtime ?? [])],
          l3_interaction: [
            new SnakeI18nServiceRegistrar(props.i18n),
            ...(config.registrars?.l3_interaction ?? []),
          ],
          l4_domain: [
            new SnakeSimulationServiceRegistrar(),
            ...(config.registrars?.l4_domain ?? []),
          ],
        },
      },
      'snake-app-root',
      props
    );

    const { store, i18n, filterManager } = props;
    const simulationService = this.kernel.l4.resolve(
      SNAKE_L4_TOKENS.SimulationService
    );

    const boardProps: SnakeBoardProps = {
      store,
      simulationService,
      onScoreChange: () => {
        this.inputRouter.vibrate(65, 0.35, 0.15);
      },
      onGameOver: (stats) => {
        this.inputRouter.vibrate(220, 0.7, 0.85);
        this.openGameOverDialog(stats);
      },
      onPauseRequest: () => {
        this.pauseAndOpenMenu();
      },
      onRestartRequest: () => {
        this.launchWithReadyPrompt('new');
      },
    };

    this.boardNode = new SnakeBoardNode('snake-board', boardProps);

    this.settingsDialog = new UIKit.ClassicV1.SettingsDialogNode(
      'dialog-settings',
      {
        title: () => i18n.t('menu.settings.heading'),
        subtitle: () => i18n.t('menu.settings.subtitle'),
        backLabel: () => i18n.t('menu.settings.back'),
        footerHint: () => i18n.t('menu.settings.hint'),
        choices: [
          {
            id: 'language',
            label: () => i18n.t('menu.settings.language'),
            options: [
              { label: () => i18n.t('menu.settings.lang_en'), value: 'en' },
              { label: () => i18n.t('menu.settings.lang_pl'), value: 'pl' },
            ],
            getValue: () => store.get().language,
            onChange: (val) => store.set({ language: val as SupportedLocale }),
          },
          {
            id: 'difficulty',
            label: () => i18n.t('menu.settings.difficulty'),
            options: [
              { label: () => i18n.t('difficulty.easy'), value: 'easy' },
              { label: () => i18n.t('difficulty.medium'), value: 'medium' },
              { label: () => i18n.t('difficulty.hard'), value: 'hard' },
            ],
            getValue: () => store.get().difficulty,
            onChange: (val) => store.set({ difficulty: val as Difficulty }),
          },
          {
            id: 'video-filter',
            label: () => i18n.t('menu.settings.video_filter'),
            options: [
              {
                label: () => i18n.t('menu.settings.filter_none'),
                value: 'none',
              },
              { label: () => i18n.t('menu.settings.filter_crt'), value: 'crt' },
              {
                label: () => i18n.t('menu.settings.filter_nokia'),
                value: 'nokia',
              },
            ],
            getValue: () => store.get().videoFilter,
            onChange: (val) =>
              store.set({ videoFilter: val as VideoFilterType }),
          },
        ],
      }
    );

    this.titleDialog = new UIKit.ClassicV1.ModalDialogNode('dialog-title', {
      title: () => i18n.t('menu.title.heading'),
      subtitle: () => i18n.t('menu.title.subtitle'),
      footerHint: () => i18n.t('menu.title.hint'),
      items: [
        {
          id: 'new-game',
          type: 'action',
          label: () => i18n.t('menu.title.new_game'),
          onSelect: () => this.launchWithReadyPrompt('new'),
        },
        {
          id: 'settings',
          type: 'action',
          label: () => i18n.t('menu.title.settings'),
          onSelect: () => this.titleDialog.openSubDialog(this.settingsDialog),
        },
      ],
    });

    this.pauseDialog = new UIKit.ClassicV1.ModalDialogNode('dialog-pause', {
      title: () => i18n.t('menu.pause.heading'),
      subtitle: () =>
        i18n.t('menu.pause.subtitle', { score: this.boardNode.getScore() }),
      footerHint: () => i18n.t('menu.pause.hint'),
      onBack: () => this.launchWithReadyPrompt('resume'),
      items: [
        {
          id: 'resume',
          type: 'action',
          label: () => i18n.t('menu.pause.resume'),
          onSelect: () => this.launchWithReadyPrompt('resume'),
        },
        {
          id: 'new-game',
          type: 'action',
          label: () => i18n.t('menu.title.new_game'),
          onSelect: () => this.launchWithReadyPrompt('new'),
        },
        {
          id: 'settings',
          type: 'action',
          label: () => i18n.t('menu.title.settings'),
          onSelect: () => this.pauseDialog.openSubDialog(this.settingsDialog),
        },
        {
          id: 'title-screen',
          type: 'action',
          label: () => i18n.t('menu.pause.title_screen'),
          onSelect: () => {
            this.boardNode.stopToTitle();
            this.openTitleDialog();
          },
        },
      ],
    });

    this.gameOverDialog = new UIKit.ClassicV1.ModalDialogNode(
      'dialog-gameover',
      {
        title: () => i18n.t('menu.gameover.heading'),
        subtitle: () => {
          const stats =
            this.state.lastGameOverStats ?? this.boardNode.getStats();
          return i18n.t('menu.gameover.subtitle', {
            score: stats.score,
            highScore: stats.highScore,
          });
        },
        footerHint: () => i18n.t('menu.gameover.hint'),
        items: [
          {
            id: 'new-game',
            type: 'action',
            label: () => i18n.t('menu.title.new_game'),
            onSelect: () => this.launchWithReadyPrompt('new'),
          },
          {
            id: 'settings',
            type: 'action',
            label: () => i18n.t('menu.title.settings'),
            onSelect: () =>
              this.gameOverDialog.openSubDialog(this.settingsDialog),
          },
          {
            id: 'title-screen',
            type: 'action',
            label: () => i18n.t('menu.pause.title_screen'),
            onSelect: () => {
              this.boardNode.stopToTitle();
              this.openTitleDialog();
            },
          },
        ],
      }
    );

    this.readyDialog = new UIKit.ClassicV1.ReadyPromptDialogNode(
      'dialog-ready',
      {
        title: () =>
          this.state.readyMode === 'new'
            ? i18n.t('overlay.ready.new_title')
            : i18n.t('overlay.ready.resume_title'),
        message: () =>
          this.state.readyMode === 'new'
            ? i18n.t('overlay.ready.new_message')
            : i18n.t('overlay.ready.resume_message', {
                score: this.boardNode.getScore(),
              }),
        promptText: () => i18n.t('overlay.ready.prompt'),
        onConfirm: (initialDir?: Direction) => {
          this.shellNode.showModal(null);
          this.boardNode.beginMovement(initialDir);
        },
        onCancel: () => {
          this.pauseAndOpenMenu();
        },
      }
    );

    this.shellNode = new UIKit.ClassicV1.ResponsiveAppShellNode('app-shell', {
      header: {
        brandTitle: () => i18n.t('header.brand_title'),
        brandBadge: () => i18n.t('header.brand_badge'),
        gamepadConnectedLabel: () => i18n.t('header.gamepad_connected'),
        gamepadDisconnectedLabel: () => i18n.t('header.gamepad_disconnected'),
        scoreCards: [
          {
            id: 'difficulty',
            label: () => i18n.t('scoreboard.difficulty'),
            value: () => {
              const diff = store.get().difficulty;
              const preset =
                DIFFICULTY_PRESETS[diff] ?? DIFFICULTY_PRESETS.medium;
              return i18n.t(preset.labelId).toUpperCase();
            },
            accent: true,
          },
          {
            id: 'score',
            label: () => i18n.t('scoreboard.score'),
            value: () => String(this.boardNode.getScore()),
          },
          {
            id: 'high-score',
            label: () => i18n.t('scoreboard.high_score'),
            value: () => String(store.get().highScore),
          },
          {
            id: 'speed',
            label: () => i18n.t('scoreboard.speed'),
            value: () => this.boardNode.getSpeedMultiplier(),
          },
        ],
      },
      contentNode: this.boardNode,
      controlDeck: {
        menuLabel: () => i18n.t('controls.menu_btn'),
        pauseLabel: () =>
          this.boardNode.getStatus() === 'PAUSED'
            ? i18n.t('controls.resume_btn')
            : i18n.t('controls.pause_btn'),
        restartLabel: () => i18n.t('controls.restart_btn'),
        onMenuClick: () => {
          const status = this.boardNode.getStatus();
          if (status === 'RUNNING' || status === 'READY') {
            this.pauseAndOpenMenu();
          } else {
            this.boardNode.stopToTitle();
            this.openTitleDialog();
          }
        },
        onPauseClick: () => {
          const status = this.boardNode.getStatus();
          if (status === 'RUNNING' || status === 'READY') {
            this.pauseAndOpenMenu();
          } else if (status === 'PAUSED') {
            this.launchWithReadyPrompt('resume');
          }
        },
        onRestartClick: () => {
          this.launchWithReadyPrompt('new');
        },
      },
    });

    this.shellNode.modalLayer.addControls(
      this.titleDialog,
      this.pauseDialog,
      this.gameOverDialog,
      this.readyDialog
    );

    this.addChild(this.shellNode);

    this.unsubI18n = i18n.subscribe(() => {
      i18n.translateDOM();
      this.viewport.setCanvasAriaLabel(i18n.t('board.canvas_aria'));
      this.requestRender();
    });

    this.unsubStore = store.subscribe((state) => {
      i18n.setLocale(state.language);
      filterManager.apply(state.videoFilter);
      this.requestRender();
    });

    this.openTitleDialog();
  }

  protected override createInitialState(): SnakeAppRootState {
    return {
      lastGameOverStats: null,
      readyMode: 'new',
    };
  }

  public openTitleDialog(initialIndex = 0): void {
    this.titleDialog.resetState();
    this.titleDialog.open(initialIndex);
    this.shellNode.showModal(this.titleDialog.id);
  }

  public pauseAndOpenMenu(initialIndex = 0): void {
    this.boardNode.pauseSession();
    this.pauseDialog.resetState();
    this.pauseDialog.open(initialIndex);
    this.shellNode.showModal(this.pauseDialog.id);
  }

  public openGameOverDialog(stats: GameStats, initialIndex = 0): void {
    this.setState({ lastGameOverStats: stats }, false);
    this.gameOverDialog.resetState();
    this.gameOverDialog.open(initialIndex);
    this.shellNode.showModal(this.gameOverDialog.id);
  }

  public launchWithReadyPrompt(mode: 'new' | 'resume'): void {
    this.setState({ readyMode: mode }, false);
    if (mode === 'new') {
      this.boardNode.prepareNewSession();
    } else {
      this.boardNode.prepareResumeSession();
    }
    this.readyDialog.showPrompt();
    this.shellNode.showModal(this.readyDialog.id);
  }

  public override dispose(): void {
    this.unsubI18n();
    this.unsubStore();
    super.dispose();
  }
}
