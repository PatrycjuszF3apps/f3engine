import {
  CanvasNode,
  ControlDirection,
  ControlEvent,
  IVirtualSurface,
  PaletteColorToken,
  StorageStore,
  UIKit,
  VirtualRect,
} from '../../../engine';
import {
  DIFFICULTY_PRESETS,
  Difficulty,
  DifficultyPreset,
  SnakePersistedState,
} from './SnakeSettings';

export type Direction = ControlDirection;
export type GameStatus = 'IDLE' | 'READY' | 'RUNNING' | 'PAUSED' | 'GAME_OVER';

export interface Point {
  x: number;
  y: number;
}

export interface GameStats {
  score: number;
  highScore: number;
  speedMultiplier: string;
  difficulty: Difficulty;
  status: GameStatus;
}

export interface SnakeBoardProps {
  store: StorageStore<SnakePersistedState>;
  gridSize?: number;
  onScoreChange?: (stats: GameStats) => void;
  onGameOver?: (stats: GameStats) => void;
  onPauseRequest?: () => void;
  onRestartRequest?: () => void;
}

export interface SnakeBoardState {
  snake: Point[];
  foods: Point[];
  obstacles: Point[];
  direction: Direction;
  directionQueue: Direction[];
  score: number;
  status: GameStatus;
}

/**
 * Application-specific board node extending the engine's `CanvasNode`.
 *
 * Encapsulates all 20x20 grid state, tick progression, collision detection,
 * normalized directional/action event handling, and virtual surface rendering.
 * Designed for OOP extension (e.g., `Snake2ArenaBoardNode extends SnakeBoardNode`).
 */
export class SnakeBoardNode
  extends CanvasNode<SnakeBoardProps, SnakeBoardState>
  implements UIKit.ClassicV1.ModalBoundsProvider
{
  constructor(id: string, props: SnakeBoardProps) {
    super(id, props);
    this.freeze();
  }

  // --- OOP Extension Hooks for Subclasses (e.g., Snake 2: Arena) ---

  protected getGridSize(): number {
    return this.props.gridSize ?? 20;
  }

  protected getPointsPerFood(): number {
    return 10;
  }

  protected getTargetFoodCount(): number {
    return 1;
  }

  protected createObstacles(): Point[] {
    return [];
  }

  protected getOuterBorderToken(pixelated: boolean): PaletteColorToken {
    return pixelated ? 'primaryEntityHead' : 'border';
  }

  protected shouldDrawSnakeEyes(): boolean {
    return true;
  }

  // --- State & Lifecycle Management ---

  protected override createInitialState(
    _props: Readonly<SnakeBoardProps>
  ): SnakeBoardState {
    const gridSize = this.getGridSize();
    const mid = Math.floor(gridSize / 2);
    const snake: Point[] = [
      { x: mid, y: mid },
      { x: mid - 1, y: mid },
      { x: mid - 2, y: mid },
    ];
    const obstacles = this.createObstacles();
    const foods: Point[] = [];
    const targetFoodCount = this.getTargetFoodCount();

    for (let i = 0; i < targetFoodCount; i++) {
      const nextFood = this.findAvailableCell(gridSize, snake, obstacles, foods);
      if (nextFood) {
        foods.push(nextFood);
      }
    }

    return {
      snake,
      foods,
      obstacles,
      direction: 'RIGHT',
      directionQueue: [],
      score: 0,
      status: 'IDLE',
    };
  }

  protected override getTickIntervalMs(): number | null {
    if (this.state.status !== 'RUNNING') {
      return null;
    }
    return this.getCurrentIntervalMs();
  }

  public getStatus(): GameStatus {
    return this.state.status;
  }

  public getScore(): number {
    return this.state.score;
  }

  public getStats(): GameStats {
    const persisted = this.props.store.get();
    return {
      score: this.state.score,
      highScore: persisted.highScore,
      speedMultiplier: this.getSpeedMultiplier(),
      difficulty: persisted.difficulty,
      status: this.state.status,
    };
  }

  public getSpeedMultiplier(): string {
    const preset = this.getDifficultyPreset();
    const ratio = preset.baseIntervalMs / this.getCurrentIntervalMs();
    return `${ratio.toFixed(1).replace('.0', '')}x`;
  }

  public prepareNewSession(): void {
    this.freeze();
    this.resetState({ recursive: false });
    this.setState({ status: 'READY' });
  }

  public prepareResumeSession(): void {
    if (this.state.status === 'PAUSED' || this.state.status === 'READY') {
      this.freeze();
      this.setState({ status: 'READY' });
    }
  }

  public beginMovement(initialDirection?: Direction): void {
    if (initialDirection) {
      this.queueDirection(initialDirection);
    }
    this.setState({ status: 'RUNNING' }, false);
    this.resetTickAccumulator();
    this.unfreeze();
  }

  public pauseSession(): void {
    if (this.state.status === 'RUNNING' || this.state.status === 'READY') {
      this.freeze();
      this.setState({ status: 'PAUSED' });
    }
  }

  public stopToTitle(): void {
    this.freeze();
    this.resetState({ recursive: false });
    this.setState({ status: 'IDLE' });
  }

  public queueDirection(nextDir: Direction): void {
    const queue = this.state.directionQueue;
    const referenceDir =
      queue.length > 0 ? queue[queue.length - 1] : this.state.direction;

    if (this.isOpposite(referenceDir, nextDir) || referenceDir === nextDir) {
      return;
    }

    if (queue.length < 2) {
      this.setState(
        {
          directionQueue: [...queue, nextDir],
        },
        false
      );
    }
  }

  public getModalTargetBounds(availableBounds: VirtualRect): VirtualRect {
    return this.computeBoardGeometry(availableBounds).boardRect;
  }

  // --- Normalized Input Event Handling ---

  protected override onControlEvent(event: ControlEvent): boolean {
    if (event.kind === 'DIRECTION' && event.phase !== 'released') {
      if (this.state.status === 'RUNNING') {
        this.queueDirection(event.direction);
        return true;
      }
      return false;
    }

    if (event.kind === 'ACTION') {
      if (
        event.action === 'PAUSE' ||
        event.action === 'CANCEL' ||
        (event.action === 'CONFIRM' && event.source === 'keyboard')
      ) {
        if (this.state.status === 'RUNNING') {
          this.props.onPauseRequest?.();
          return true;
        }
      }

      if (event.action === 'RESTART') {
        this.props.onRestartRequest?.();
        return true;
      }
    }

    return false;
  }

  // --- Grid Logic Tick ---

  protected override onTick(): void {
    if (this.state.status !== 'RUNNING') return;

    const queue = [...this.state.directionQueue];
    const nextDirection =
      queue.length > 0 ? queue.shift()! : this.state.direction;

    const head = { ...this.state.snake[0] };
    switch (nextDirection) {
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

    const gridSize = this.getGridSize();

    // 1. Check wall or obstacle collision
    if (
      head.x < 0 ||
      head.x >= gridSize ||
      head.y < 0 ||
      head.y >= gridSize ||
      this.state.obstacles.some((o) => o.x === head.x && o.y === head.y)
    ) {
      this.setState({ direction: nextDirection, directionQueue: queue }, false);
      this.triggerGameOver();
      return;
    }

    // 2. Check food pickup & self-collision
    const eatenIdx = this.state.foods.findIndex(
      (f) => f.x === head.x && f.y === head.y
    );
    const willEat = eatenIdx !== -1;
    const bodyToCheck = willEat
      ? this.state.snake
      : this.state.snake.slice(0, -1);

    if (bodyToCheck.some((seg) => seg.x === head.x && seg.y === head.y)) {
      this.setState({ direction: nextDirection, directionQueue: queue }, false);
      this.triggerGameOver();
      return;
    }

    const nextSnake = [head, ...this.state.snake];
    const nextFoods = [...this.state.foods];
    let nextScore = this.state.score;

    if (willEat) {
      nextScore += this.getPointsPerFood();
      const currentHigh = this.props.store.get().highScore;
      if (nextScore > currentHigh) {
        this.props.store.set({ highScore: nextScore });
      }
      nextFoods.splice(eatenIdx, 1);
      const spawned = this.findAvailableCell(
        gridSize,
        nextSnake,
        this.state.obstacles,
        nextFoods
      );
      if (spawned) {
        nextFoods.push(spawned);
      }
    } else {
      nextSnake.pop();
    }

    this.setState({
      snake: nextSnake,
      foods: nextFoods,
      direction: nextDirection,
      directionQueue: queue,
      score: nextScore,
    });

    if (willEat) {
      this.props.onScoreChange?.(this.getStats());
    }
  }

  // --- Virtual Surface Rendering ---

  protected override onRender(
    surface: IVirtualSurface,
    availableBounds: VirtualRect
  ): void {
    if (availableBounds.width <= 0 || availableBounds.height <= 0) return;

    const { boardX, boardY, boardPx, cellSize } =
      this.computeBoardGeometry(availableBounds);
    const gridSize = this.getGridSize();
    const pixelated = surface.getPalette().pixelated;

    // 1. Outer board border
    surface.strokeRect(
      boardX - 2,
      boardY - 2,
      boardPx + 4,
      boardPx + 4,
      this.getOuterBorderToken(pixelated),
      2
    );

    // 2. Checkerboard background cells
    for (let gx = 0; gx < gridSize; gx++) {
      for (let gy = 0; gy < gridSize; gy++) {
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

    // 3. Obstacles (if any)
    for (const obs of this.state.obstacles) {
      const ox = boardX + obs.x * cellSize;
      const oy = boardY + obs.y * cellSize;
      surface.fillRect(ox, oy, cellSize, cellSize, 'border');
      surface.strokeRect(ox, oy, cellSize, cellSize, 'textMuted', 1);
    }

    // 4. Pixelated Nokia style vs Standard/CRT style
    if (pixelated && this.state.obstacles.length === 0) {
      this.renderNokiaEntities(surface, boardX, boardY, cellSize);
      return;
    }

    // 5. Food targets
    for (const food of this.state.foods) {
      const fx = boardX + food.x * cellSize + Math.floor(cellSize / 2);
      const fy = boardY + food.y * cellSize + Math.floor(cellSize / 2);
      const radius = Math.max(2, Math.floor(cellSize * 0.38));

      surface.fillCircle(fx, fy, radius, 'targetFill');
      if (radius >= 3 && !pixelated) {
        surface.setPixel(fx - 1, fy - 1, 'targetHighlight');
        if (this.state.obstacles.length === 0) {
          surface.setPixel(fx - 2, fy - 1, 'targetHighlight');
          surface.setPixel(fx - 1, fy - 2, 'targetHighlight');
        }
      }
    }

    // 6. Snake segments
    const pad = cellSize >= 10 ? 1 : 0;
    const drawEyes = this.shouldDrawSnakeEyes();

    this.state.snake.forEach((segment, index) => {
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

      if (isHead && drawEyes) {
        this.drawEyes(
          surface,
          boardX,
          boardY,
          cellSize,
          segment,
          'primaryEntityEye'
        );
      }
    });
  }

  private renderNokiaEntities(
    surface: IVirtualSurface,
    boardX: number,
    boardY: number,
    cellSize: number
  ): void {
    const sub = Math.max(1, Math.floor(cellSize / 3));
    for (const food of this.state.foods) {
      const fx = boardX + food.x * cellSize;
      const fy = boardY + food.y * cellSize;
      surface.fillRect(fx + sub, fy, sub, sub, 'targetFill');
      surface.fillRect(fx, fy + sub, sub, sub, 'targetFill');
      surface.fillRect(fx + sub * 2, fy + sub, sub, sub, 'targetFill');
      surface.fillRect(fx + sub, fy + sub * 2, sub, sub, 'targetFill');
    }

    const gap = cellSize >= 8 ? 1 : 0;
    const drawEyes = this.shouldDrawSnakeEyes();

    this.state.snake.forEach((segment, index) => {
      const isHead = index === 0;
      const sx = boardX + segment.x * cellSize + gap;
      const sy = boardY + segment.y * cellSize + gap;
      const segSize = Math.max(2, cellSize - gap * 2);

      surface.fillRect(
        sx,
        sy,
        segSize,
        segSize,
        isHead ? 'primaryEntityHead' : 'primaryEntityBody'
      );

      if (isHead && drawEyes) {
        this.drawEyes(
          surface,
          boardX,
          boardY,
          cellSize,
          segment,
          'primaryEntityEye'
        );
      }
    });
  }

  private drawEyes(
    surface: IVirtualSurface,
    boardX: number,
    boardY: number,
    cellSize: number,
    head: Point,
    colorToken: PaletteColorToken
  ): void {
    const cx = boardX + head.x * cellSize + Math.floor(cellSize / 2);
    const cy = boardY + head.y * cellSize + Math.floor(cellSize / 2);
    const offset = Math.max(1, Math.floor(cellSize * 0.22));

    let eye1: Point = { x: cx, y: cy };
    let eye2: Point = { x: cx, y: cy };

    switch (this.state.direction) {
      case 'RIGHT':
        eye1 = { x: cx + offset, y: cy - offset };
        eye2 = { x: cx + offset, y: cy + offset };
        break;
      case 'LEFT':
        eye1 = { x: cx - offset, y: cy - offset };
        eye2 = { x: cx - offset, y: cy + offset };
        break;
      case 'UP':
        eye1 = { x: cx - offset, y: cy - offset };
        eye2 = { x: cx + offset, y: cy - offset };
        break;
      case 'DOWN':
        eye1 = { x: cx - offset, y: cy + offset };
        eye2 = { x: cx + offset, y: cy + offset };
        break;
    }

    surface.setPixel(eye1.x, eye1.y, colorToken);
    surface.setPixel(eye2.x, eye2.y, colorToken);
  }

  private computeBoardGeometry(availableBounds: VirtualRect): {
    boardX: number;
    boardY: number;
    boardPx: number;
    cellSize: number;
    boardRect: VirtualRect;
  } {
    const gridSize = this.getGridSize();
    const maxBoardDim = Math.max(
      60,
      Math.min(availableBounds.width - 4, availableBounds.height - 4)
    );
    const cellSize = Math.max(3, Math.floor(maxBoardDim / gridSize));
    const boardPx = cellSize * gridSize;
    const boardX = Math.round(
      availableBounds.x + (availableBounds.width - boardPx) / 2
    );
    const boardY = Math.round(
      availableBounds.y + (availableBounds.height - boardPx) / 2
    );

    return {
      boardX,
      boardY,
      boardPx,
      cellSize,
      boardRect: {
        x: boardX,
        y: boardY,
        width: boardPx,
        height: boardPx,
      },
    };
  }

  private triggerGameOver(): void {
    this.freeze();
    this.setState({ status: 'GAME_OVER' });
    this.props.onGameOver?.(this.getStats());
  }

  private findAvailableCell(
    gridSize: number,
    snake: Point[],
    obstacles: Point[],
    foods: Point[]
  ): Point | null {
    const available: Point[] = [];
    for (let x = 0; x < gridSize; x++) {
      for (let y = 0; y < gridSize; y++) {
        const onSnake = snake.some((s) => s.x === x && s.y === y);
        const onObstacle = obstacles.some((o) => o.x === x && o.y === y);
        const onFood = foods.some((f) => f.x === x && f.y === y);
        if (!onSnake && !onObstacle && !onFood) {
          available.push({ x, y });
        }
      }
    }
    if (available.length === 0) return null;
    const idx = Math.floor(Math.random() * available.length);
    return available[idx];
  }

  private getDifficultyPreset(): DifficultyPreset {
    const { difficulty } = this.props.store.get();
    return DIFFICULTY_PRESETS[difficulty] ?? DIFFICULTY_PRESETS.medium;
  }

  private getCurrentIntervalMs(): number {
    const preset = this.getDifficultyPreset();
    const speedStep = Math.floor(this.state.score / preset.stepEveryPoints);
    return Math.max(
      preset.minIntervalMs,
      preset.baseIntervalMs - speedStep * preset.speedDecrementMs
    );
  }

  private isOpposite(dirA: Direction, dirB: Direction): boolean {
    return (
      (dirA === 'UP' && dirB === 'DOWN') ||
      (dirA === 'DOWN' && dirB === 'UP') ||
      (dirA === 'LEFT' && dirB === 'RIGHT') ||
      (dirA === 'RIGHT' && dirB === 'LEFT')
    );
  }
}
