import {
  GameLoop,
  IVirtualSurface,
  StorageStore,
  VirtualRect,
} from '../../../engine';
import {
  DIFFICULTY_PRESETS,
  Difficulty,
  SnakePersistedState,
} from './SnakeSettings';

export type Direction = 'UP' | 'DOWN' | 'LEFT' | 'RIGHT';
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

/**
 * Core gameplay logic and board renderer for the Snake demo.
 * Renders strictly onto the abstract virtual pixel grid (IVirtualSurface)
 * using declared palette tokens — with zero direct dependency on Canvas2D or WebGL.
 */
export class SnakeGame {
  private readonly gridSize = 20;
  private readonly store: StorageStore<SnakePersistedState>;
  private readonly loop: GameLoop;
  private readonly onUpdate: (stats: GameStats) => void;
  private readonly onRequestRender: () => void;

  private snake: Point[] = [];
  private food: Point = { x: 10, y: 10 };
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

  public startNewGame(): void {
    this.loop.stop();
    this.resetState();
    this.status = 'RUNNING';
    this.emitStats();
    this.loop.start();
  }

  public resume(): void {
    if (this.status === 'PAUSED') {
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

  /**
   * Renders the 20x20 board, apple, and snake onto the virtual pixel grid (IVirtualSurface)
   * inside the provided target bounds, returning the actual board rectangle.
   */
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

    // Outer board border
    surface.strokeRect(
      boardX - 2,
      boardY - 2,
      boardPx + 4,
      boardPx + 4,
      pixelated ? 'primaryEntityHead' : 'border',
      2
    );

    // Checkerboard background cells
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

    if (pixelated) {
      this.renderNokiaStyle(surface, boardX, boardY, cellSize);
      return boardRect;
    }

    // Apple (target) on the virtual pixel grid
    const fx = boardX + this.food.x * cellSize + Math.floor(cellSize / 2);
    const fy = boardY + this.food.y * cellSize + Math.floor(cellSize / 2);
    const radius = Math.max(2, Math.floor(cellSize * 0.38));

    surface.fillCircle(fx, fy, radius, 'targetFill');
    if (radius >= 3) {
      surface.setPixel(fx - 1, fy - 1, 'targetHighlight');
      surface.setPixel(fx - 2, fy - 1, 'targetHighlight');
      surface.setPixel(fx - 1, fy - 2, 'targetHighlight');
    }

    // Snake segments
    const pad = cellSize >= 10 ? 1 : 0;
    this.snake.forEach((segment, index) => {
      const isHead = index === 0;
      const sx = boardX + segment.x * cellSize + pad;
      const sy = boardY + segment.y * cellSize + pad;
      const segSize = Math.max(2, cellSize - pad * 2);
      const r = cellSize >= 10 ? (isHead ? 2 : 1) : 0;

      surface.fillRoundRect(
        sx,
        sy,
        segSize,
        segSize,
        r,
        isHead ? 'primaryEntityHead' : 'primaryEntityBody'
      );

      if (isHead) {
        this.drawEyes(surface, boardX, boardY, cellSize, segment, 'primaryEntityEye');
      }
    });

    return boardRect;
  }

  private renderNokiaStyle(
    surface: IVirtualSurface,
    boardX: number,
    boardY: number,
    cellSize: number
  ): void {
    // Pixelated apple (hollow diamond pattern inspired by Nokia 3310)
    const fx = boardX + this.food.x * cellSize;
    const fy = boardY + this.food.y * cellSize;
    const sub = Math.max(1, Math.floor(cellSize / 3));

    surface.fillRect(fx + sub, fy, sub, sub, 'targetFill');
    surface.fillRect(fx, fy + sub, sub, sub, 'targetFill');
    surface.fillRect(fx + sub * 2, fy + sub, sub, sub, 'targetFill');
    surface.fillRect(fx + sub, fy + sub * 2, sub, sub, 'targetFill');

    // Crisp square LCD segments with 1px spacing
    const gap = cellSize >= 8 ? 1 : 0;
    this.snake.forEach((segment, index) => {
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

      if (isHead) {
        this.drawEyes(surface, boardX, boardY, cellSize, segment, 'primaryEntityEye');
      }
    });
  }

  private drawEyes(
    surface: IVirtualSurface,
    boardX: number,
    boardY: number,
    cellSize: number,
    head: Point,
    colorToken: string
  ): void {
    const cx = boardX + head.x * cellSize + Math.floor(cellSize / 2);
    const cy = boardY + head.y * cellSize + Math.floor(cellSize / 2);
    const offset = Math.max(1, Math.floor(cellSize * 0.22));

    let eye1: Point = { x: cx, y: cy };
    let eye2: Point = { x: cx, y: cy };

    switch (this.direction) {
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

    if (
      head.x < 0 ||
      head.x >= this.gridSize ||
      head.y < 0 ||
      head.y >= this.gridSize
    ) {
      this.handleGameOver();
      return;
    }

    const willEat = head.x === this.food.x && head.y === this.food.y;
    const bodyToCheck = willEat ? this.snake : this.snake.slice(0, -1);

    if (
      bodyToCheck.some((segment) => segment.x === head.x && segment.y === head.y)
    ) {
      this.handleGameOver();
      return;
    }

    this.snake.unshift(head);

    if (willEat) {
      this.score += 10;
      const currentHigh = this.store.get().highScore;
      if (this.score > currentHigh) {
        this.store.set({ highScore: this.score });
      }
      this.spawnFood();
      this.emitStats();
    } else {
      this.snake.pop();
    }
  }

  private handleGameOver(): void {
    this.status = 'GAME_OVER';
    this.loop.stop();
    this.emitStats();
    this.onRequestRender();
  }

  private spawnFood(): void {
    const available: Point[] = [];
    for (let x = 0; x < this.gridSize; x++) {
      for (let y = 0; y < this.gridSize; y++) {
        if (!this.snake.some((s) => s.x === x && s.y === y)) {
          available.push({ x, y });
        }
      }
    }
    if (available.length > 0) {
      const idx = Math.floor(Math.random() * available.length);
      this.food = available[idx];
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
