import {
  AppManifest,
  EngineDebugHooks,
  GamepadAction,
  GamepadDirection,
  GamepadManager,
  I18nManager,
  MenuScreenConfig,
  MenuSystem,
  OverlayManager,
  StorageStore,
  VideoFilterManager,
  VideoFilterType,
  VirtualUIDecorator,
  VirtualViewport,
} from '../../../engine';
import manifestData from './manifest.json';
import {
  DEFAULT_SNAKE_STATE,
  Difficulty,
  SNAKE_VIEWPORT_DEFAULTS,
  SnakePersistedState,
  createSnakePalettes,
} from './SnakeSettings';
import { Direction, GameStats, SnakeGame } from './SnakeGame';
import { SnakeHUDRenderer } from './SnakeHUDRenderer';
import { StringId, SupportedLocale, createGameI18n } from './i18n';

export const SNAKE_MANIFEST: AppManifest = manifestData;

const STORAGE_KEY = 'f3engine_snake_settings_v1';

const KEY_DIRECTION_MAP: Record<string, Direction> = {
  ArrowUp: 'UP',
  KeyW: 'UP',
  ArrowDown: 'DOWN',
  KeyS: 'DOWN',
  ArrowLeft: 'LEFT',
  KeyA: 'LEFT',
  ArrowRight: 'RIGHT',
  KeyD: 'RIGHT',
};

const DIRECTION_TO_KEYCODE: Record<Direction, string> = {
  UP: 'ArrowUp',
  DOWN: 'ArrowDown',
  LEFT: 'ArrowLeft',
  RIGHT: 'ArrowRight',
};

export interface DemoSession {
  readonly id: string;
  readonly name: string;
  readonly manifest: AppManifest;
  readonly hooks: EngineDebugHooks;
  readonly i18n: I18nManager<SupportedLocale, StringId>;
  dispose(): void;
}

/**
 * Mounts a full instance of the Snake demo inside the provided host container,
 * exposing engine debug hooks and a clean `dispose()` lifecycle method for demo switching/resetting.
 */
export function mountSnakeDemo(container: HTMLElement): DemoSession {
  const store = new StorageStore<SnakePersistedState>(
    STORAGE_KEY,
    DEFAULT_SNAKE_STATE
  );
  const i18n = createGameI18n(store.get().language);
  const snakePalettes = createSnakePalettes();
  const filterManager = new VideoFilterManager([container], snakePalettes);

  const viewport = new VirtualViewport({
    container,
    manifest: SNAKE_MANIFEST,
    virtualWidth: SNAKE_VIEWPORT_DEFAULTS.virtualWidth,
    aspectRatio: SNAKE_VIEWPORT_DEFAULTS.aspectRatio,
    windowScalePercent: SNAKE_VIEWPORT_DEFAULTS.windowScalePercent,
    lockAspectRatio: SNAKE_VIEWPORT_DEFAULTS.lockAspectRatio,
    palette: filterManager.getPalette(),
    canvasAriaLabel: i18n.t('board.canvas_aria'),
  });
  filterManager.attachViewport(viewport);

  const uiDecorator = new VirtualUIDecorator(viewport);
  const menu = new MenuSystem(uiDecorator);
  const overlayManager = new OverlayManager(uiDecorator);

  let lastStats: GameStats | null = null;
  let activeMenuView: 'title' | 'pause' | 'gameover' | 'settings' | null = 'title';
  let settingsReturnTo: 'title' | 'pause' | 'gameover' = 'title';
  let activeReadyMode: 'new' | 'resume' | null = null;

  function launchWithReadyOverlay(mode: 'new' | 'resume'): void {
    activeMenuView = null;
    activeReadyMode = mode;
    menu.hide();

    if (mode === 'new') {
      game.prepareNewGame();
    } else {
      game.prepareResume();
    }

    overlayManager.showPrompt({
      title:
        mode === 'new'
          ? i18n.t('overlay.ready.new_title')
          : i18n.t('overlay.ready.resume_title'),
      message:
        mode === 'new'
          ? i18n.t('overlay.ready.new_message')
          : i18n.t('overlay.ready.resume_message', { score: game.getScore() }),
      promptText: i18n.t('overlay.ready.prompt'),
      onConfirm: (trigger) => {
        activeReadyMode = null;
        if (trigger instanceof KeyboardEvent) {
          if (trigger.code === 'Escape') {
            game.pause();
            showPauseMenu();
            return;
          }
          const initialDir = KEY_DIRECTION_MAP[trigger.code];
          if (initialDir) {
            game.queueDirection(initialDir);
          }
        }
        game.beginMovement();
      },
    });
  }

  function createTitleScreen(): MenuScreenConfig {
    return {
      title: i18n.t('menu.title.heading'),
      subtitle: i18n.t('menu.title.subtitle'),
      items: [
        {
          id: 'new-game',
          type: 'action',
          label: i18n.t('menu.title.new_game'),
          onSelect: () => {
            launchWithReadyOverlay('new');
          },
        },
        {
          id: 'settings',
          type: 'action',
          label: i18n.t('menu.title.settings'),
          onSelect: () => {
            openSettingsScreen('title');
          },
        },
      ],
      footerHint: i18n.t('menu.title.hint'),
    };
  }

  function createPauseScreen(): MenuScreenConfig {
    return {
      title: i18n.t('menu.pause.heading'),
      subtitle: i18n.t('menu.pause.subtitle', { score: game.getScore() }),
      items: [
        {
          id: 'resume',
          type: 'action',
          label: i18n.t('menu.pause.resume'),
          onSelect: () => {
            launchWithReadyOverlay('resume');
          },
        },
        {
          id: 'new-game',
          type: 'action',
          label: i18n.t('menu.title.new_game'),
          onSelect: () => {
            launchWithReadyOverlay('new');
          },
        },
        {
          id: 'settings',
          type: 'action',
          label: i18n.t('menu.title.settings'),
          onSelect: () => {
            openSettingsScreen('pause');
          },
        },
        {
          id: 'title-screen',
          type: 'action',
          label: i18n.t('menu.pause.title_screen'),
          onSelect: () => {
            overlayManager.hide();
            game.stopToTitle();
            showTitleMenu();
          },
        },
      ],
      footerHint: i18n.t('menu.pause.hint'),
      onBack: () => {
        launchWithReadyOverlay('resume');
      },
    };
  }

  function createGameOverScreen(stats: GameStats): MenuScreenConfig {
    return {
      title: i18n.t('menu.gameover.heading'),
      subtitle: i18n.t('menu.gameover.subtitle', {
        score: stats.score,
        highScore: stats.highScore,
      }),
      items: [
        {
          id: 'new-game',
          type: 'action',
          label: i18n.t('menu.title.new_game'),
          onSelect: () => {
            launchWithReadyOverlay('new');
          },
        },
        {
          id: 'settings',
          type: 'action',
          label: i18n.t('menu.title.settings'),
          onSelect: () => {
            openSettingsScreen('gameover');
          },
        },
        {
          id: 'title-screen',
          type: 'action',
          label: i18n.t('menu.pause.title_screen'),
          onSelect: () => {
            overlayManager.hide();
            game.stopToTitle();
            showTitleMenu();
          },
        },
      ],
      footerHint: i18n.t('menu.gameover.hint'),
    };
  }

  function createSettingsScreen(): MenuScreenConfig {
    const goBack = () => {
      if (settingsReturnTo === 'pause') {
        showPauseMenu(2);
      } else if (settingsReturnTo === 'gameover' && lastStats) {
        showGameOverMenu(lastStats, 1);
      } else {
        showTitleMenu(1);
      }
    };

    return {
      title: i18n.t('menu.settings.heading'),
      subtitle: i18n.t('menu.settings.subtitle'),
      items: [
        {
          id: 'language',
          type: 'choice',
          label: i18n.t('menu.settings.language'),
          options: [
            { label: i18n.t('menu.settings.lang_en'), value: 'en' },
            { label: i18n.t('menu.settings.lang_pl'), value: 'pl' },
          ],
          getValue: () => store.get().language,
          onChange: (val) => {
            store.set({ language: val as SupportedLocale });
          },
        },
        {
          id: 'difficulty',
          type: 'choice',
          label: i18n.t('menu.settings.difficulty'),
          options: [
            { label: i18n.t('difficulty.easy'), value: 'easy' },
            { label: i18n.t('difficulty.medium'), value: 'medium' },
            { label: i18n.t('difficulty.hard'), value: 'hard' },
          ],
          getValue: () => store.get().difficulty,
          onChange: (val) => {
            store.set({ difficulty: val as Difficulty });
          },
        },
        {
          id: 'video-filter',
          type: 'choice',
          label: i18n.t('menu.settings.video_filter'),
          options: [
            { label: i18n.t('menu.settings.filter_none'), value: 'none' },
            { label: i18n.t('menu.settings.filter_crt'), value: 'crt' },
            { label: i18n.t('menu.settings.filter_nokia'), value: 'nokia' },
          ],
          getValue: () => store.get().videoFilter,
          onChange: (val) => {
            store.set({ videoFilter: val as VideoFilterType });
          },
        },
        {
          id: 'back',
          type: 'action',
          label: i18n.t('menu.settings.back'),
          onSelect: goBack,
        },
      ],
      footerHint: i18n.t('menu.settings.hint'),
      onBack: goBack,
    };
  }

  function showTitleMenu(initialIndex = 0): void {
    activeMenuView = 'title';
    menu.show(createTitleScreen(), initialIndex);
  }

  function showPauseMenu(initialIndex = 0): void {
    activeMenuView = 'pause';
    menu.show(createPauseScreen(), initialIndex);
  }

  function showGameOverMenu(stats: GameStats, initialIndex = 0): void {
    activeMenuView = 'gameover';
    menu.show(createGameOverScreen(stats), initialIndex);
  }

  function openSettingsScreen(
    returnTo: 'title' | 'pause' | 'gameover',
    initialIndex = 0
  ): void {
    settingsReturnTo = returnTo;
    activeMenuView = 'settings';
    menu.show(createSettingsScreen(), initialIndex);
  }

  function handleDirectionInput(dir: Direction): void {
    if (overlayManager.isVisible()) {
      game.queueDirection(dir);
      overlayManager.triggerConfirm();
      return;
    }

    if (menu.isVisible()) {
      menu.handleKeyDown(
        new KeyboardEvent('keydown', { code: DIRECTION_TO_KEYCODE[dir] })
      );
      return;
    }

    if (game.getStatus() === 'RUNNING') {
      game.queueDirection(dir);
    }
  }

  const gamepadManager = new GamepadManager({
    onConnectionChange: (connected) => {
      hudRenderer.setGamepadStatus(connected);
      viewport.requestRender();
    },
    onDirection: (dir: GamepadDirection) => {
      handleDirectionInput(dir);
    },
    onAction: (action: GamepadAction) => {
      if (overlayManager.isVisible()) {
        if (action === 'BACK') {
          overlayManager.hide();
          game.pause();
          showPauseMenu();
        } else {
          overlayManager.triggerConfirm();
        }
        return;
      }

      if (menu.isVisible()) {
        if (action === 'CONFIRM' || action === 'START') {
          menu.handleKeyDown(new KeyboardEvent('keydown', { code: 'Enter' }));
        } else if (action === 'BACK') {
          menu.handleKeyDown(new KeyboardEvent('keydown', { code: 'Escape' }));
        } else if (action === 'RESTART') {
          launchWithReadyOverlay('new');
        }
        return;
      }

      if (game.getStatus() === 'RUNNING') {
        if (action === 'START' || action === 'BACK') {
          game.pause();
          showPauseMenu();
        } else if (action === 'RESTART') {
          launchWithReadyOverlay('new');
        }
      }
    },
  });

  function handleStatsUpdate(stats: GameStats): void {
    const prevScore = lastStats?.score ?? 0;
    const prevStatus = lastStats?.status;
    lastStats = stats;

    if (stats.score > prevScore) {
      gamepadManager.vibrate(65, 0.35, 0.15);
    }

    if (stats.status === 'GAME_OVER') {
      if (prevStatus === 'RUNNING') {
        gamepadManager.vibrate(220, 0.7, 0.85);
      }
      overlayManager.hide();
      showGameOverMenu(stats);
    }
  }

  const game = new SnakeGame(store, handleStatsUpdate, () => {
    viewport.requestRender();
  });

  const hudRenderer = new SnakeHUDRenderer(
    uiDecorator,
    i18n,
    game,
    menu,
    overlayManager,
    {
      onDirection: (dir) => handleDirectionInput(dir),
      onMenuClick: () => {
        overlayManager.hide();
        const status = game.getStatus();
        if (status === 'RUNNING' || status === 'READY') {
          game.pause();
          showPauseMenu();
        } else {
          game.stopToTitle();
          showTitleMenu();
        }
      },
      onPauseClick: () => {
        const status = game.getStatus();
        if (status === 'RUNNING' || status === 'READY') {
          overlayManager.hide();
          game.pause();
          showPauseMenu();
        } else if (status === 'PAUSED') {
          launchWithReadyOverlay('resume');
        }
      },
      onRestartClick: () => {
        launchWithReadyOverlay('new');
      },
    }
  );

  viewport.setRenderCallback(() => {
    hudRenderer.renderFrame();
  });

  gamepadManager.start();

  function refreshActiveMenusAndOverlays(): void {
    i18n.translateDOM();
    viewport.setCanvasAriaLabel(i18n.t('board.canvas_aria'));
    hudRenderer.setGamepadStatus(gamepadManager.isConnected());

    if (menu.isVisible() && activeMenuView) {
      const currentIdx = menu.getSelectedIndex();
      if (activeMenuView === 'title') {
        menu.show(createTitleScreen(), currentIdx);
      } else if (activeMenuView === 'pause') {
        menu.show(createPauseScreen(), currentIdx);
      } else if (activeMenuView === 'gameover' && lastStats) {
        menu.show(createGameOverScreen(lastStats ?? game.getStats()), currentIdx);
      } else if (activeMenuView === 'settings') {
        menu.show(createSettingsScreen(), currentIdx);
      }
    } else if (overlayManager.isVisible() && activeReadyMode) {
      launchWithReadyOverlay(activeReadyMode);
    }
  }

  const unsubI18n = i18n.subscribe(() => {
    refreshActiveMenusAndOverlays();
    viewport.requestRender();
  });

  const unsubStore = store.subscribe((state) => {
    i18n.setLocale(state.language);
    filterManager.apply(state.videoFilter);
    game.refreshView();
  });

  showTitleMenu();

  const handleKeyDown = (event: KeyboardEvent) => {
    const target = event.target as HTMLElement | null;
    if (target && (target.tagName === 'INPUT' || target.tagName === 'SELECT')) {
      return;
    }

    if (overlayManager.isVisible()) {
      return;
    }

    if (menu.isVisible()) {
      menu.handleKeyDown(event);
      return;
    }

    if (event.code in KEY_DIRECTION_MAP) {
      event.preventDefault();
      if (game.getStatus() === 'RUNNING') {
        game.queueDirection(KEY_DIRECTION_MAP[event.code]);
      }
      return;
    }

    if (event.code === 'Space' || event.code === 'Escape') {
      event.preventDefault();
      if (game.getStatus() === 'RUNNING') {
        game.pause();
        showPauseMenu();
      }
      return;
    }

    if (event.code === 'KeyR') {
      event.preventDefault();
      launchWithReadyOverlay('new');
    }
  };

  window.addEventListener('keydown', handleKeyDown);

  return {
    id: SNAKE_MANIFEST.id,
    name: SNAKE_MANIFEST.name,
    manifest: SNAKE_MANIFEST,
    hooks: viewport.getDebugHooks(),
    i18n,
    dispose: () => {
      window.removeEventListener('keydown', handleKeyDown);
      unsubI18n();
      unsubStore();
      overlayManager.hide();
      gamepadManager.stop();
      game.dispose();
      viewport.dispose();
    },
  };
}

export {
  SnakeGame,
  type Direction,
  type GameStatus,
  type Point,
  type GameStats,
} from './SnakeGame';
export { SnakeHUDRenderer, type SnakeHUDActions } from './SnakeHUDRenderer';
export {
  DIFFICULTY_PRESETS,
  SNAKE_VIEWPORT_DEFAULTS,
  DEFAULT_SNAKE_STATE,
  createSnakePalettes,
  type Difficulty,
  type DifficultyPreset,
  type SnakePersistedState,
} from './SnakeSettings';
export {
  LOCALE_ASSETS,
  createGameI18n,
  type SupportedLocale,
  type StringId,
} from './i18n';
