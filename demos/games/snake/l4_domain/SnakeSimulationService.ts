import { ControlDirection, createServiceToken } from '../../../../engine';
import type { StringId } from '../l3_interaction/SnakeI18nService';

export type Direction = ControlDirection;
export type Difficulty = 'easy' | 'medium' | 'hard';
export type GameStatus = 'IDLE' | 'READY' | 'RUNNING' | 'PAUSED' | 'GAME_OVER';

export interface Point {
  x: number;
  y: number;
}

export interface DifficultyPreset {
  labelId: StringId;
  baseIntervalMs: number;
  minIntervalMs: number;
  stepEveryPoints: number;
  speedDecrementMs: number;
}

export const DIFFICULTY_PRESETS: Record<Difficulty, DifficultyPreset> = {
  easy: {
    labelId: 'difficulty.easy',
    baseIntervalMs: 165,
    minIntervalMs: 85,
    stepEveryPoints: 40,
    speedDecrementMs: 6,
  },
  medium: {
    labelId: 'difficulty.medium',
    baseIntervalMs: 130,
    minIntervalMs: 60,
    stepEveryPoints: 30,
    speedDecrementMs: 8,
  },
  hard: {
    labelId: 'difficulty.hard',
    baseIntervalMs: 92,
    minIntervalMs: 45,
    stepEveryPoints: 20,
    speedDecrementMs: 7,
  },
};

export interface GameStats {
  score: number;
  highScore: number;
  speedMultiplier: string;
  difficulty: Difficulty;
  status: GameStatus;
}

export interface SnakeDomainGridState {
  snake: Point[];
  foods: Point[];
  obstacles: Point[];
  direction: Direction;
  directionQueue: Direction[];
  score: number;
  status: GameStatus;
}

export interface SnakeTickResult {
  readonly nextState: SnakeDomainGridState;
  readonly outcome: 'MOVED' | 'ATE_FOOD' | 'COLLIDED';
}

/**
 * Pure L4 Domain service contract encapsulating the universe rules of Classic 20x20 Snake.
 * Completely independent of `CanvasNode`, `IVirtualSurface`, or browser APIs.
 */
export interface ISnakeSimulationService {
  createInitialGridState(
    gridSize: number,
    targetFoodCount?: number
  ): SnakeDomainGridState;
  enqueueDirection(
    state: Readonly<SnakeDomainGridState>,
    nextDir: Direction
  ): Direction[];
  computeIntervalMs(score: number, difficulty: Difficulty): number;
  computeSpeedMultiplierLabel(score: number, difficulty: Difficulty): string;
  stepSimulation(
    state: Readonly<SnakeDomainGridState>,
    gridSize: number,
    pointsPerFood: number
  ): SnakeTickResult;
}

export const SNAKE_L4_TOKENS = {
  SimulationService: createServiceToken<ISnakeSimulationService, 'L4_DOMAIN'>(
    'L4_DOMAIN',
    'snake.l4.simulation_service',
    'Pure domain service computing Snake grid movement, collisions, food spawning, and speed progression.'
  ),
} as const;

export class SnakeSimulationService implements ISnakeSimulationService {
  public createInitialGridState(
    gridSize: number,
    targetFoodCount = 1
  ): SnakeDomainGridState {
    const mid = Math.floor(gridSize / 2);
    const snake: Point[] = [
      { x: mid, y: mid },
      { x: mid - 1, y: mid },
      { x: mid - 2, y: mid },
    ];
    const obstacles: Point[] = [];
    const foods: Point[] = [];

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

  public enqueueDirection(
    state: Readonly<SnakeDomainGridState>,
    nextDir: Direction
  ): Direction[] {
    const queue = state.directionQueue;
    const referenceDir =
      queue.length > 0 ? queue[queue.length - 1] : state.direction;

    if (this.isOpposite(referenceDir, nextDir) || referenceDir === nextDir) {
      return queue;
    }

    if (queue.length < 2) {
      return [...queue, nextDir];
    }
    return queue;
  }

  public computeIntervalMs(score: number, difficulty: Difficulty): number {
    const preset = DIFFICULTY_PRESETS[difficulty] ?? DIFFICULTY_PRESETS.medium;
    const speedStep = Math.floor(score / preset.stepEveryPoints);
    return Math.max(
      preset.minIntervalMs,
      preset.baseIntervalMs - speedStep * preset.speedDecrementMs
    );
  }

  public computeSpeedMultiplierLabel(
    score: number,
    difficulty: Difficulty
  ): string {
    const preset = DIFFICULTY_PRESETS[difficulty] ?? DIFFICULTY_PRESETS.medium;
    const interval = this.computeIntervalMs(score, difficulty);
    const ratio = preset.baseIntervalMs / interval;
    return `${ratio.toFixed(1).replace('.0', '')}x`;
  }

  public stepSimulation(
    state: Readonly<SnakeDomainGridState>,
    gridSize: number,
    pointsPerFood: number
  ): SnakeTickResult {
    const queue = [...state.directionQueue];
    const nextDirection =
      queue.length > 0 ? queue.shift()! : state.direction;

    const head = { ...state.snake[0] };
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

    // 1. Check wall or obstacle collision
    if (
      head.x < 0 ||
      head.x >= gridSize ||
      head.y < 0 ||
      head.y >= gridSize ||
      state.obstacles.some((o) => o.x === head.x && o.y === head.y)
    ) {
      return {
        nextState: {
          ...state,
          direction: nextDirection,
          directionQueue: queue,
          status: 'GAME_OVER',
        },
        outcome: 'COLLIDED',
      };
    }

    // 2. Check food pickup & self-collision
    const eatenIdx = state.foods.findIndex(
      (f) => f.x === head.x && f.y === head.y
    );
    const willEat = eatenIdx !== -1;
    const bodyToCheck = willEat ? state.snake : state.snake.slice(0, -1);

    if (bodyToCheck.some((seg) => seg.x === head.x && seg.y === head.y)) {
      return {
        nextState: {
          ...state,
          direction: nextDirection,
          directionQueue: queue,
          status: 'GAME_OVER',
        },
        outcome: 'COLLIDED',
      };
    }

    const nextSnake = [head, ...state.snake];
    const nextFoods = [...state.foods];
    let nextScore = state.score;

    if (willEat) {
      nextScore += pointsPerFood;
      nextFoods.splice(eatenIdx, 1);
      const spawned = this.findAvailableCell(
        gridSize,
        nextSnake,
        state.obstacles,
        nextFoods
      );
      if (spawned) {
        nextFoods.push(spawned);
      }
    } else {
      nextSnake.pop();
    }

    return {
      nextState: {
        ...state,
        snake: nextSnake,
        foods: nextFoods,
        direction: nextDirection,
        directionQueue: queue,
        score: nextScore,
      },
      outcome: willEat ? 'ATE_FOOD' : 'MOVED',
    };
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

  private isOpposite(dirA: Direction, dirB: Direction): boolean {
    return (
      (dirA === 'UP' && dirB === 'DOWN') ||
      (dirA === 'DOWN' && dirB === 'UP') ||
      (dirA === 'LEFT' && dirB === 'RIGHT') ||
      (dirA === 'RIGHT' && dirB === 'LEFT')
    );
  }
}
