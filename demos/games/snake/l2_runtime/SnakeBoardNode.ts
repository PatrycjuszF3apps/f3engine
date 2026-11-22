import {
  CanvasNode,
  ControlEvent,
  IVirtualSurface,
  PaletteColorToken,
  StorageStore,
  UIKit,
  VirtualRect,
} from '../../../../engine';
import { SnakePersistedState } from '../l1_infrastructure/SnakeSettingsRepository';
import {
  Direction,
  GameStats,
  GameStatus,
  ISnakeSimulationService,
  Point,
  SNAKE_L4_TOKENS,
  SnakeDomainGridState,
  SnakeSimulationService,
} from '../l4_domain/SnakeSimulationService';

export interface SnakeBoardProps {
  store: StorageStore<SnakePersistedState>;
  simulationService?: ISnakeSimulationService;
  gridSize?: number;
  onScoreChange?: (stats: GameStats) => void;
  onGameOver?: (stats: GameStats) => void;
  onPauseRequest?: () => void;
  onRestartRequest?: () => void;
}

export type SnakeBoardState = SnakeDomainGridState;

/**
 * L2 Runtime `CanvasNode` representing the 20x20 Snake board.
 * Delegates all domain rules (movement, collision checks, food spawning, speed scaling)
 * to the injected L4 `ISnakeSimulationService`.
 */
export class SnakeBoardNode
  extends CanvasNode<SnakeBoardProps, SnakeBoardState>
  implements UIKit.ClassicV1.ModalBoundsProvider
{
  private readonly fallbackSimulation = new SnakeSimulationService();

  constructor(id: string, props: SnakeBoardProps) {
    super(id, props);
    this.freeze();
  }

  private getSimulation(): ISnakeSimulationService {
    if (this.props.simulationService) {
      return this.props.simulationService;
    }
    const kernel = this.getRoot()?.getKernel();
    if (kernel && kernel.l4.hasProvider(SNAKE_L4_TOKENS.SimulationService)) {
      return kernel.l4.resolve(SNAKE_L4_TOKENS.SimulationService);
    }
    return this.fallbackSimulation;
  }

  protected getGridSize(): number {
    return this.props.gridSize ?? 20;
  }

  protected getPointsPerFood(): number {
    return 10;
  }

  protected override createInitialState(
    props: Readonly<SnakeBoardProps>
  ): SnakeBoardState {
    const sim = props.simulationService ?? new SnakeSimulationService();
    return sim.createInitialGridState(props.gridSize ?? 20, 1);
  }

  protected override getTickIntervalMs(): number | null {
    if (this.state.status !== 'RUNNING') {
      return null;
    }
    const { difficulty } = this.props.store.get();
    return this.getSimulation().computeIntervalMs(this.state.score, difficulty);
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
    const { difficulty } = this.props.store.get();
    return this.getSimulation().computeSpeedMultiplierLabel(
      this.state.score,
      difficulty
    );
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
    const nextQueue = this.getSimulation().enqueueDirection(
      this.state,
      nextDir
    );
    if (nextQueue !== this.state.directionQueue) {
      this.setState({ directionQueue: nextQueue }, false);
    }
  }

  public getModalTargetBounds(availableBounds: VirtualRect): VirtualRect {
    return this.computeBoardGeometry(availableBounds).boardRect;
  }

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

  protected override onTick(): void {
    if (this.state.status !== 'RUNNING') return;

    const result = this.getSimulation().stepSimulation(
      this.state,
      this.getGridSize(),
      this.getPointsPerFood()
    );

    if (result.outcome === 'COLLIDED') {
      this.freeze();
      this.setState(result.nextState);
      this.props.onGameOver?.(this.getStats());
      return;
    }

    if (result.outcome === 'ATE_FOOD') {
      const currentHigh = this.props.store.get().highScore;
      if (result.nextState.score > currentHigh) {
        this.props.store.set({ highScore: result.nextState.score });
      }
    }

    this.setState(result.nextState);

    if (result.outcome === 'ATE_FOOD') {
      this.props.onScoreChange?.(this.getStats());
    }
  }

  protected override onRender(
    surface: IVirtualSurface,
    availableBounds: VirtualRect
  ): void {
    if (availableBounds.width <= 0 || availableBounds.height <= 0) return;

    const { boardX, boardY, boardPx, cellSize } =
      this.computeBoardGeometry(availableBounds);
    const gridSize = this.getGridSize();
    const pixelated = surface.getPalette().pixelated;

    surface.strokeRect(
      boardX - 2,
      boardY - 2,
      boardPx + 4,
      boardPx + 4,
      pixelated ? 'primaryEntityHead' : 'border',
      2
    );

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

    if (pixelated) {
      this.renderNokiaEntities(surface, boardX, boardY, cellSize);
      return;
    }

    for (const food of this.state.foods) {
      const fx = boardX + food.x * cellSize + Math.floor(cellSize / 2);
      const fy = boardY + food.y * cellSize + Math.floor(cellSize / 2);
      const radius = Math.max(2, Math.floor(cellSize * 0.38));

      surface.fillCircle(fx, fy, radius, 'targetFill');
      if (radius >= 3) {
        surface.setPixel(fx - 1, fy - 1, 'targetHighlight');
        surface.setPixel(fx - 2, fy - 1, 'targetHighlight');
        surface.setPixel(fx - 1, fy - 2, 'targetHighlight');
      }
    }

    const pad = cellSize >= 10 ? 1 : 0;
    this.state.snake.forEach((segment, index) => {
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

      if (isHead) {
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
}
