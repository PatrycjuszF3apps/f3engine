import {
  AppManifest,
  ColorPalette,
  GameLoop,
  GamepadAction,
  GamepadDirection,
  GamepadManager,
  I18nManager,
  IVirtualSurface,
  MenuScreenConfig,
  MenuSystem,
  OverlayManager,
  StorageStore,
  VideoFilterManager,
  VideoFilterPalette,
  VideoFilterType,
  VirtualRect,
  VirtualUIDecorator,
  VirtualViewport,
} from '../../../engine';
import manifestData from './manifest.json';
import {
  DIFFICULTY_PRESETS,
  DEFAULT_SNAKE_STATE,
  Difficulty,
  Direction,
  GameStats,
  GameStatus,
  LOCALE_ASSETS,
  Point,
  SNAKE_VIEWPORT_DEFAULTS,
  SnakePersistedState,
  StringId,
  SupportedLocale,
  type DemoSession,
} from '../snake';

export const SNAKE2_MANIFEST: AppManifest = manifestData;

const STORAGE_KEY_SNAKE2 = 'f3engine_snake2_settings_v1';

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

const SNAKE2_PALETTE_DEFINITIONS: Record<
  VideoFilterType,
  { definition: VideoFilterPalette; pixelated: boolean }
> = {
  none: {
    pixelated: false,
    definition: {
      bgOuter: '#090614',
      panelBg: '#1b1336',
      panelAlt: '#110b24',
      border: '#3b2d66',
      borderHighlight: '#f59e0b',
      textMain: '#f8fafc',
      textMuted: '#a78bfa',
      textInverse: '#1e1b4b',
      accent: '#d97706',
      accentBright: '#fbbf24',
      overlayDim: '#070410',
      boardBgEven: '#0f0a21',
      boardBgOdd: '#150f2e',
      primaryEntityHead: '#fbbf24',
      primaryEntityBody: '#f59e0b',
      primaryEntityEye: '#110b24',
      targetFill: '#ec4899',
      targetHighlight: '#fbcfe8',
    },
  },
  crt: {
    pixelated: false,
    definition: {
      bgOuter: '#06030d',
      panelBg: '#180f30',
      panelAlt: '#0e081f',
      border: '#4c1d95',
      borderHighlight: '#38bdf8',
      textMain: '#f0f9ff',
      textMuted: '#c084fc',
      textInverse: '#0f172a',
      accent: '#f59e0b',
      accentBright: '#fde047',
      overlayDim: '#05020a',
      boardBgEven: '#0c061a',
      boardBgOdd: '#120a26',
      primaryEntityHead: '#fde047',
      primaryEntityBody: '#f59e0b',
      primaryEntityEye: '#0c061a',
      targetFill: '#f43f5e',
      targetHighlight: '#fecdd3',
    },
  },
  nokia: {
    pixelated: true,
    definition: {
      bgOuter: '#8bac0f',
      panelBg: '#9bbc0f',
      panelAlt: '#8bac0f',
      border: '#306230',
      borderHighlight: '#0f380f',
      textMain: '#0f380f',
      textMuted: '#306230',
      textInverse: '#9bbc0f',
      accent: '#0f380f',
      accentBright: '#0f380f',
      overlayDim: '#8bac0f',
      boardBgEven: '#9bbc0f',
      boardBgOdd: '#8bac0f',
      primaryEntityHead: '#0f380f',
      primaryEntityBody: '#306230',
      primaryEntityEye: '#9bbc0f',
      targetFill: '#0f380f',
      targetHighlight: '#8bac0f',
    },
  },
};

function createSnake2Palettes(): Record<VideoFilterType, ColorPalette> {
  return {
    none: new ColorPalette(
      SNAKE2_PALETTE_DEFINITIONS.none.definition,
      SNAKE2_PALETTE_DEFINITIONS.none.pixelated
    ),
    crt: new ColorPalette(
      SNAKE2_PALETTE_DEFINITIONS.crt.definition,
      SNAKE2_PALETTE_DEFINITIONS.crt.pixelated
    ),
    nokia: new ColorPalette(
      SNAKE2_PALETTE_DEFINITIONS.nokia.definition,
      SNAKE2_PALETTE_DEFINITIONS.nokia.pixelated
    ),
  };
}

function createSnake2I18n(
  initialLocale: SupportedLocale = 'en'
): I18nManager<SupportedLocale, StringId> {
  const customAssets: Record<SupportedLocale, Record<StringId, string>> = {
    en: {
      ...LOCALE_ASSETS.en,
      'header.brand_title': 'SNAKE II',
      'header.brand_badge': 'ARENA',
      'menu.title.heading': 'SNAKE II: ARENA',
      'menu.title.subtitle': 'Obstacle Pillars & Twin-Apple Arcade Challenge',
    },
    pl: {
      ...LOCALE_ASSETS.pl,
      'header.brand_title': 'SNAKE II',
      'header.brand_badge': 'ARENA',
      'menu.title.heading': 'SNAKE II: ARENA',
      'menu.title.subtitle': 'Filary na planszy i podwójne jabłka',
    },
  };
  return new I18nManager<SupportedLocale, StringId>(customAssets, initialLocale);
}

/**
 * Second demo game ("Snake 2: Arena") with central arena obstacle pillars and dual targets.
 * Used to test and showcase switching and resetting demos in the HTML5 Launcher.
 */
class Snake2ArenaGame {
  private readonly gridSize = 20;
  private readonly store: StorageStore<SnakePersistedState>;
  private readonly loop: GameLoop;
  private readonly onUpdate: (stats: GameStats) => void;
  private readonly onRequestRender: () => void;

  private readonly obstacles: Point[] = [
    { x: 5, y: 5 },
    { x: 6, y: 5 },
    { x: 5, y: 6 },
    { x: 14, y: 5 },
    { x: 13, y: 5 },
    { x: 14, y: 6 },
    { x: 5, y: 14 },
    { x: 6, y: 14 },
    { x: 5, y: 13 },
    { x: 14, y: 14 },
    { x: 13, y: 14 },
    { x: 14, y: 13 },
  ];

  private snake: Point[] = [];
  private foods: Point[] = [];
  private direction: Direction = 'RIGHT';
  private directionQueue: Direction[] = [];
  private status: GameStatus = 'IDLE';
  private score = 0;

  constructor(
    store: StorageStore<SnakePersistedState>,
    onUpdate: (stats: GameStats) => void,
    onRequestRender: () => void
  ) {
    this.store = store;
    this.onUpdate = onUpdate;
    this.onRequestRender = onRequestRender;

    this.loop = new GameLoop({
      onTick: () => this.tick(),
      onRender: () => this.onRequestRender(),
      getTickIntervalMs: () => this.getCurrentIntervalMs(),
    });

    this.resetState();
    this.emitStats();
  }

  public prepareNewGame(): void {
    this.loop.stop();
    this.resetState();
    this.status = 'READY';
    this.emitStats();
    this.onRequestRender();
  }

  public prepareResume(): void {
    if (this.status === 'PAUSED' || this.status === 'READY') {
      this.loop.stop();
      this.status = 'READY';
      this.emitStats();
      this.onRequestRender();
    }
  }

  public beginMovement(): void {
    if (
      this.status === 'READY' ||
      this.status === 'PAUSED' ||
      this.status === 'IDLE'
    ) {
      this.status = 'RUNNING';
      this.emitStats();
      this.loop.start();
    }
  }

  public pause(): void {
    if (this.status === 'RUNNING') {
      this.status = 'PAUSED';
      this.loop.stop();
      this.emitStats();
      this.onRequestRender();
    }
  }

  public stopToTitle(): void {
    this.loop.stop();
    this.resetState();
    this.status = 'IDLE';
    this.emitStats();
    this.onRequestRender();
  }

  public dispose(): void {
    this.loop.stop();
  }

  public queueDirection(nextDir: Direction): void {
    const referenceDir =
      this.directionQueue.length > 0
        ? this.directionQueue[this.directionQueue.length - 1]
        : this.direction;

    if (this.isOpposite(referenceDir, nextDir) || referenceDir === nextDir) {
      return;
    }

    if (this.directionQueue.length < 2) {
      this.directionQueue.push(nextDir);
    }
  }

  public getStatus(): GameStatus {
    return this.status;
  }

  public getScore(): number {
    return this.score;
  }

  public getStats(): GameStats {
    const state = this.store.get();
    return {
      score: this.score,
      highScore: state.highScore,
      speedMultiplier: this.getSpeedMultiplier(),
      difficulty: state.difficulty,
      status: this.status,
    };
  }

  public refreshView(): void {
    this.emitStats();
    this.onRequestRender();
  }

  public renderBoard(
    surface: IVirtualSurface,
    availableBounds: VirtualRect
  ): VirtualRect {
    const maxBoardDim = Math.max(
      60,
      Math.min(availableBounds.width - 4, availableBounds.height - 4)
    );
    const cellSize = Math.max(3, Math.floor(maxBoardDim / this.gridSize));
    const boardPx = cellSize * this.gridSize;
    const boardX = Math.round(
      availableBounds.x + (availableBounds.width - boardPx) / 2
    );
    const boardY = Math.round(
      availableBounds.y + (availableBounds.height - boardPx) / 2
    );

    const boardRect: VirtualRect = {
      x: boardX,
      y: boardY,
      width: boardPx,
      height: boardPx,
    };

    const pixelated = surface.getPalette().pixelated;

    surface.strokeRect(
      boardX - 2,
      boardY - 2,
      boardPx + 4,
      boardPx + 4,
      pixelated ? 'primaryEntityHead' : 'borderHighlight',
      2
    );

    for (let gx = 0; gx < this.gridSize; gx++) {
      for (let gy = 0; gy < this.gridSize; gy++) {
        const token = (gx + gy) % 2 === 0 ? 'boardBgEven' : 'boardBgOdd';
        surface.fillRect(
          boardX + gx * cellSize,
          boardY + gy * cellSize,
          cellSize,
          cellSize,
          token
        );
      }
    }

    // Draw arena obstacle pillars
    for (const obs of this.obstacles) {
      const ox = boardX + obs.x * cellSize;
      const oy = boardY + obs.y * cellSize;
      surface.fillRect(ox, oy, cellSize, cellSize, 'border');
      surface.strokeRect(ox, oy, cellSize, cellSize, 'textMuted', 1);
    }

    // Draw dual targets
    for (const food of this.foods) {
      const fx = boardX + food.x * cellSize + Math.floor(cellSize / 2);
      const fy = boardY + food.y * cellSize + Math.floor(cellSize / 2);
      const radius = Math.max(2, Math.floor(cellSize * 0.38));
      surface.fillCircle(fx, fy, radius, 'targetFill');
      if (radius >= 3 && !pixelated) {
        surface.setPixel(fx - 1, fy - 1, 'targetHighlight');
      }
    }

    // Draw snake segments
    const pad = cellSize >= 10 ? 1 : 0;
    this.snake.forEach((segment, index) => {
      const isHead = index === 0;
      const sx = boardX + segment.x * cellSize + pad;
      const sy = boardY + segment.y * cellSize + pad;
      const segSize = Math.max(2, cellSize - pad * 2);
      const r = !pixelated && cellSize >= 10 ? (isHead ? 2 : 1) : 0;

      surface.fillRoundRect(
        sx,
        sy,
        segSize,
        segSize,
        r,
        isHead ? 'primaryEntityHead' : 'primaryEntityBody'
      );
    });

    return boardRect;
  }

  private resetState(): void {
    const mid = Math.floor(this.gridSize / 2);
    this.snake = [
      { x: mid, y: mid },
      { x: mid - 1, y: mid },
      { x: mid - 2, y: mid },
    ];
    this.direction = 'RIGHT';
    this.directionQueue = [];
    this.score = 0;
    this.foods = [];
    this.spawnFood();
    this.spawnFood();
  }

  private getDifficultyPreset() {
    const { difficulty } = this.store.get();
    return DIFFICULTY_PRESETS[difficulty] ?? DIFFICULTY_PRESETS.medium;
  }

  private getCurrentIntervalMs(): number {
    const preset = this.getDifficultyPreset();
    const speedStep = Math.floor(this.score / preset.stepEveryPoints);
    return Math.max(
      preset.minIntervalMs,
      preset.baseIntervalMs - speedStep * preset.speedDecrementMs
    );
  }

  private getSpeedMultiplier(): string {
    const preset = this.getDifficultyPreset();
    const ratio = preset.baseIntervalMs / this.getCurrentIntervalMs();
    return `${ratio.toFixed(1).replace('.0', '')}x`;
  }

  private tick(): void {
    if (this.directionQueue.length > 0) {
      this.direction = this.directionQueue.shift()!;
    }

    const head = { ...this.snake[0] };
    switch (this.direction) {
      case 'UP':
        head.y -= 1;
        break;
      case 'DOWN':
        head.y += 1;
        break;
      case 'LEFT':
        head.x -= 1;
        break;
      case 'RIGHT':
        head.x += 1;
        break;
    }

    // Wall or obstacle collision
    if (
      head.x < 0 ||
      head.x >= this.gridSize ||
      head.y < 0 ||
      head.y >= this.gridSize ||
      this.obstacles.some((o) => o.x === head.x && o.y === head.y)
    ) {
      this.status = 'GAME_OVER';
      this.loop.stop();
      this.emitStats();
      this.onRequestRender();
      return;
    }

    const eatenIdx = this.foods.findIndex(
      (f) => f.x === head.x && f.y === head.y
    );
    const willEat = eatenIdx !== -1;
    const bodyToCheck = willEat ? this.snake : this.snake.slice(0, -1);

    if (
      bodyToCheck.some((segment) => segment.x === head.x && segment.y === head.y)
    ) {
      this.status = 'GAME_OVER';
      this.loop.stop();
      this.emitStats();
      this.onRequestRender();
      return;
    }

    this.snake.unshift(head);

    if (willEat) {
      this.score += 15;
      const currentHigh = this.store.get().highScore;
      if (this.score > currentHigh) {
        this.store.set({ highScore: this.score });
      }
      this.foods.splice(eatenIdx, 1);
      this.spawnFood();
      this.emitStats();
    } else {
      this.snake.pop();
    }
  }

  private spawnFood(): void {
    const available: Point[] = [];
    for (let x = 0; x < this.gridSize; x++) {
      for (let y = 0; y < this.gridSize; y++) {
        const occupiedBySnake = this.snake.some((s) => s.x === x && s.y === y);
        const occupiedByObstacle = this.obstacles.some(
          (o) => o.x === x && o.y === y
        );
        const occupiedByFood = this.foods.some((f) => f.x === x && f.y === y);
        if (!occupiedBySnake && !occupiedByObstacle && !occupiedByFood) {
          available.push({ x, y });
        }
      }
    }
    if (available.length > 0) {
      const idx = Math.floor(Math.random() * available.length);
      this.foods.push(available[idx]);
    }
  }

  private isOpposite(dirA: Direction, dirB: Direction): boolean {
    return (
      (dirA === 'UP' && dirB === 'DOWN') ||
      (dirA === 'DOWN' && dirB === 'UP') ||
      (dirA === 'LEFT' && dirB === 'RIGHT') ||
      (dirA === 'RIGHT' && dirB === 'LEFT')
    );
  }

  private emitStats(): void {
    this.onUpdate(this.getStats());
  }
}

/**
 * Mounts an instance of the "Snake 2: Arena" demo inside the provided host container.
 */
export function mountSnake2Demo(container: HTMLElement): DemoSession {
  const store = new StorageStore<SnakePersistedState>(
    STORAGE_KEY_SNAKE2,
    DEFAULT_SNAKE_STATE
  );
  const i18n = createSnake2I18n(store.get().language);
  const palettes = createSnake2Palettes();
  const filterManager = new VideoFilterManager([container], palettes);

  const viewport = new VirtualViewport({
    container,
    manifest: SNAKE2_MANIFEST,
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
  let gamepadConnected = false;

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
          onSelect: () => launchWithReadyOverlay('new'),
        },
        {
          id: 'settings',
          type: 'action',
          label: i18n.t('menu.title.settings'),
          onSelect: () => openSettingsScreen('title'),
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
          onSelect: () => launchWithReadyOverlay('resume'),
        },
        {
          id: 'new-game',
          type: 'action',
          label: i18n.t('menu.title.new_game'),
          onSelect: () => launchWithReadyOverlay('new'),
        },
        {
          id: 'settings',
          type: 'action',
          label: i18n.t('menu.title.settings'),
          onSelect: () => openSettingsScreen('pause'),
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
      onBack: () => launchWithReadyOverlay('resume'),
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
          onSelect: () => launchWithReadyOverlay('new'),
        },
        {
          id: 'settings',
          type: 'action',
          label: i18n.t('menu.title.settings'),
          onSelect: () => openSettingsScreen('gameover'),
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
          onChange: (val) => store.set({ language: val as SupportedLocale }),
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
          onChange: (val) => store.set({ difficulty: val as Difficulty }),
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
          onChange: (val) => store.set({ videoFilter: val as VideoFilterType }),
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
      gamepadConnected = connected;
      viewport.requestRender();
    },
    onDirection: (dir: GamepadDirection) => handleDirectionInput(dir),
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

  const game = new Snake2ArenaGame(store, handleStatsUpdate, () => {
    viewport.requestRender();
  });

  function renderFrame(): void {
    const surface = uiDecorator.getSurface();
    const theme = uiDecorator.getTheme();
    const vw = surface.width;
    const vh = surface.height;
    const modalVisible = menu.isVisible() || overlayManager.isVisible();

    uiDecorator.beginFrame(modalVisible);
    surface.clear(theme.bgOuter);

    const stats = game.getStats();
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
      height: footerRect.y - (headerRect.y + headerRect.height) - margin * 2,
    };

    uiDecorator.drawPanel(headerRect, {
      bgColor: theme.panelBg,
      borderColor: theme.borderHighlight,
      radius: 3,
    });

    const topRowY = headerRect.y + 4;
    const titleScale = Math.max(1, Math.min(1.6, headerH / 46));
    const titleM = uiDecorator.drawText(
      i18n.t('header.brand_title'),
      headerRect.x + 6,
      topRowY,
      {
        color: theme.accentBright,
        scale: titleScale,
      }
    );

    uiDecorator.drawBadge(
      headerRect.x + 6 + titleM.width + 4,
      topRowY + Math.max(0, Math.floor((titleM.height - 9) / 2)),
      i18n.t('header.brand_badge'),
      {
        bgColor: theme.panelAlt,
        borderColor: theme.accent,
        textColor: theme.accentBright,
        scale: Math.max(0.75, titleScale * 0.7),
      }
    );

    const padLabel = gamepadConnected
      ? i18n.t('header.gamepad_connected')
      : i18n.t('header.gamepad_disconnected');
    uiDecorator.drawBadge(
      headerRect.x + headerRect.width - 5,
      topRowY,
      padLabel,
      {
        bgColor: gamepadConnected ? theme.accent : theme.panelAlt,
        borderColor: gamepadConnected ? theme.accentBright : theme.border,
        textColor: gamepadConnected ? theme.textInverse : theme.textMuted,
        scale: Math.max(0.75, Math.min(1.05, titleScale * 0.72)),
        alignRight: true,
      }
    );

    const cardsY = topRowY + titleM.height + 5;
    const cardsH = Math.max(22, headerRect.height - (cardsY - headerRect.y) - 4);
    const cardGap = 3;
    const cardsTotalW = headerRect.width - 10;
    const cardW = Math.floor((cardsTotalW - cardGap * 3) / 4);

    const preset =
      DIFFICULTY_PRESETS[stats.difficulty] ?? DIFFICULTY_PRESETS.medium;
    const diffLabel = i18n.t(preset.labelId).toUpperCase();

    const cards = [
      { label: i18n.t('scoreboard.difficulty'), value: diffLabel, accent: true },
      { label: i18n.t('scoreboard.score'), value: String(stats.score) },
      { label: i18n.t('scoreboard.high_score'), value: String(stats.highScore) },
      { label: i18n.t('scoreboard.speed'), value: stats.speedMultiplier },
    ];

    cards.forEach((c, idx) => {
      uiDecorator.drawScoreCard(
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

    const boardRect = game.renderBoard(surface, boardAvailRect);

    uiDecorator.drawPanel(footerRect, {
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

    uiDecorator.drawDpad(
      {
        x: footerRect.x + innerPad + 2,
        y: footerRect.y + innerPad,
        width: dpadW,
        height: ctrlH,
      },
      (dir) => handleDirectionInput(dir)
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
        ? i18n.t('controls.resume_btn')
        : i18n.t('controls.pause_btn');

    uiDecorator.drawButton(
      'hud-btn-menu',
      { x: actionsAreaX, y: btnY, width: btnW, height: btnH },
      i18n.t('controls.menu_btn'),
      () => {
        overlayManager.hide();
        const status = game.getStatus();
        if (status === 'RUNNING' || status === 'READY') {
          game.pause();
          showPauseMenu();
        } else {
          game.stopToTitle();
          showTitleMenu();
        }
      }
    );
    uiDecorator.drawButton(
      'hud-btn-pause',
      {
        x: actionsAreaX + btnW + btnGap,
        y: btnY,
        width: btnW,
        height: btnH,
      },
      pauseLabel,
      () => {
        const status = game.getStatus();
        if (status === 'RUNNING' || status === 'READY') {
          overlayManager.hide();
          game.pause();
          showPauseMenu();
        } else if (status === 'PAUSED') {
          launchWithReadyOverlay('resume');
        }
      }
    );
    uiDecorator.drawButton(
      'hud-btn-restart',
      {
        x: actionsAreaX + (btnW + btnGap) * 2,
        y: btnY,
        width: btnW,
        height: btnH,
      },
      i18n.t('controls.restart_btn'),
      () => launchWithReadyOverlay('new')
    );

    if (menu.isVisible()) {
      menu.render(boardRect);
    } else if (overlayManager.isVisible()) {
      overlayManager.render(boardRect);
    }

    viewport.present();
  }

  viewport.setRenderCallback(renderFrame);
  gamepadManager.start();

  const unsubI18n = i18n.subscribe(() => {
    i18n.translateDOM();
    viewport.setCanvasAriaLabel(i18n.t('board.canvas_aria'));
    if (menu.isVisible() && activeMenuView) {
      const idx = menu.getSelectedIndex();
      if (activeMenuView === 'title') menu.show(createTitleScreen(), idx);
      else if (activeMenuView === 'pause') menu.show(createPauseScreen(), idx);
      else if (activeMenuView === 'gameover' && lastStats)
        menu.show(createGameOverScreen(lastStats), idx);
      else if (activeMenuView === 'settings')
        menu.show(createSettingsScreen(), idx);
    } else if (overlayManager.isVisible() && activeReadyMode) {
      launchWithReadyOverlay(activeReadyMode);
    }
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
    if (overlayManager.isVisible()) return;
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
    id: SNAKE2_MANIFEST.id,
    name: SNAKE2_MANIFEST.name,
    manifest: SNAKE2_MANIFEST,
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
