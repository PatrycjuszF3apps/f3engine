export interface FrameTelemetrySnapshot {
  readonly frameId: number;
  readonly lastDt: number;
  readonly elapsedMs: number;
  readonly smoothedFps: number;
}

export interface IFrameClockTelemetryService {
  recordFrameSample(frameId: number, dt: number, elapsedMs: number): void;
  getSnapshot(): FrameTelemetrySnapshot;
}

/**
 * Pure L1 infrastructure service measuring physical frame cadence and smoothed FPS.
 */
export class DefaultFrameClockTelemetryService
  implements IFrameClockTelemetryService
{
  private frameId = 0;
  private lastDt = 0;
  private elapsedMs = 0;
  private smoothedFps = 60;

  public recordFrameSample(
    frameId: number,
    dt: number,
    elapsedMs: number
  ): void {
    this.frameId = frameId;
    this.lastDt = dt;
    this.elapsedMs = elapsedMs;
    if (dt > 0.0001) {
      const instantFps = 1 / dt;
      this.smoothedFps = this.smoothedFps * 0.9 + instantFps * 0.1;
    }
  }

  public getSnapshot(): FrameTelemetrySnapshot {
    return {
      frameId: this.frameId,
      lastDt: this.lastDt,
      elapsedMs: this.elapsedMs,
      smoothedFps: Math.round(this.smoothedFps),
    };
  }
}
