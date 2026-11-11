export interface GameLoopCallbacks {
  onTick: () => void;
  onRender: () => void;
  getTickIntervalMs: () => number;
}

/**
 * Universal game loop powered by requestAnimationFrame with a dynamic logic tick interval.
 */
export class GameLoop {
  private animationFrameId: number | null = null;
  private lastTickTime = 0;
  private running = false;
  private readonly callbacks: GameLoopCallbacks;

  constructor(callbacks: GameLoopCallbacks) {
    this.callbacks = callbacks;
  }

  public start(): void {
    this.stop();
    this.running = true;
    this.lastTickTime = performance.now();

    const frame = (now: number) => {
      if (!this.running) return;

      const interval = this.callbacks.getTickIntervalMs();
      if (now - this.lastTickTime >= interval) {
        this.lastTickTime = now;
        this.callbacks.onTick();
      }

      this.callbacks.onRender();

      if (this.running) {
        this.animationFrameId = requestAnimationFrame(frame);
      }
    };

    this.animationFrameId = requestAnimationFrame(frame);
  }

  public stop(): void {
    this.running = false;
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
  }

  public isRunning(): boolean {
    return this.running;
  }
}
