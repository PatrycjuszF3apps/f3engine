export type GamepadDirection = 'UP' | 'DOWN' | 'LEFT' | 'RIGHT';
export type GamepadAction = 'CONFIRM' | 'BACK' | 'START' | 'RESTART';

export interface GamepadCallbacks {
  onDirection?: (direction: GamepadDirection) => void;
  onAction?: (action: GamepadAction) => void;
  onAnyInput?: (input: { direction?: GamepadDirection; action?: GamepadAction }) => void;
  onConnectionChange?: (connected: boolean, controllerName?: string) => void;
}

const STICK_DEADZONE = 0.45;
const REPEAT_INITIAL_DELAY_MS = 320;
const REPEAT_INTERVAL_MS = 140;

/**
 * Universal controller manager (Gamepad API) in the engine layer.
 * Supports D-Pad, analog sticks with deadzone, action buttons (A/B/X/Y/Start),
 * directional auto-repeat for menu navigation, and dual-rumble haptic feedback.
 */
export class GamepadManager {
  private readonly callbacks: GamepadCallbacks;
  private pollTimerId: number | null = null;
  private running = false;

  private connected = false;
  private controllerName: string | undefined;

  private prevButtons: boolean[] = [];
  private prevDirection: GamepadDirection | null = null;
  private directionHoldStart = 0;
  private lastRepeatTime = 0;

  private readonly handleConnect = (e: GamepadEvent) => {
    const id = e.gamepad?.id ?? this.getActiveGamepads()[0]?.id;
    this.updateConnectionState(true, id);
  };

  private readonly handleDisconnect = () => {
    const pads = this.getActiveGamepads();
    if (pads.length === 0) {
      this.updateConnectionState(false, undefined);
    } else {
      this.updateConnectionState(true, pads[0].id);
    }
  };

  constructor(callbacks: GamepadCallbacks) {
    this.callbacks = callbacks;
  }

  public start(): void {
    if (this.running) return;
    this.running = true;

    window.addEventListener('gamepadconnected', this.handleConnect);
    window.addEventListener('gamepaddisconnected', this.handleDisconnect);

    const initialPads = this.getActiveGamepads();
    if (initialPads.length > 0) {
      this.updateConnectionState(true, initialPads[0].id);
    }

    const loop = (now: number) => {
      if (!this.running) return;
      this.poll(now);
      this.pollTimerId = requestAnimationFrame(loop);
    };
    this.pollTimerId = requestAnimationFrame(loop);
  }

  public stop(): void {
    this.running = false;
    window.removeEventListener('gamepadconnected', this.handleConnect);
    window.removeEventListener('gamepaddisconnected', this.handleDisconnect);
    if (this.pollTimerId !== null) {
      cancelAnimationFrame(this.pollTimerId);
      this.pollTimerId = null;
    }
  }

  /**
   * Polls the state of connected gamepads (automatically invoked every rAF frame).
   */
  public poll(now: number = performance.now()): void {
    this.pollGamepad(now);
  }

  public isConnected(): boolean {
    return this.connected;
  }

  public getControllerName(): string | undefined {
    return this.controllerName;
  }

  /**
   * Triggers controller vibration if supported by the device and browser.
   */
  public vibrate(durationMs = 80, weakMagnitude = 0.3, strongMagnitude = 0.15): void {
    const pad = this.getActiveGamepads()[0];
    if (!pad || !pad.vibrationActuator) return;

    try {
      void pad.vibrationActuator.playEffect('dual-rumble', {
        startDelay: 0,
        duration: durationMs,
        weakMagnitude,
        strongMagnitude,
      });
    } catch {
      // Ignore unsupported vibration errors on the host device
    }
  }

  private getActiveGamepads(): Gamepad[] {
    if (typeof navigator.getGamepads !== 'function') return [];
    const raw = navigator.getGamepads();
    const list: Gamepad[] = [];
    for (const pad of raw) {
      if (pad && pad.connected) {
        list.push(pad);
      }
    }
    return list;
  }

  private updateConnectionState(isConnected: boolean, name?: string): void {
    if (this.connected !== isConnected || this.controllerName !== name) {
      this.connected = isConnected;
      this.controllerName = name;
      this.callbacks.onConnectionChange?.(isConnected, name);
    }
  }

  private pollGamepad(now: number): void {
    const pads = this.getActiveGamepads();
    if (pads.length === 0) {
      if (this.connected) {
        this.updateConnectionState(false, undefined);
      }
      this.prevButtons = [];
      this.prevDirection = null;
      return;
    }

    const pad = pads[0];
    if (!this.connected) {
      this.updateConnectionState(true, pad.id);
    }

    // 1. Read direction from D-Pad (buttons 12-15) and left/right analog sticks
    const currentDirection = this.extractDirection(pad);

    if (currentDirection) {
      if (currentDirection !== this.prevDirection) {
        this.prevDirection = currentDirection;
        this.directionHoldStart = now;
        this.lastRepeatTime = now;
        this.emitDirection(currentDirection);
      } else if (
        now - this.directionHoldStart >= REPEAT_INITIAL_DELAY_MS &&
        now - this.lastRepeatTime >= REPEAT_INTERVAL_MS
      ) {
        this.lastRepeatTime = now;
        this.emitDirection(currentDirection);
      }
    } else {
      this.prevDirection = null;
    }

    // 2. Read action buttons (rising edge / just pressed)
    const buttons = pad.buttons.map((b) => b.pressed);

    if (this.isJustPressed(buttons, 0)) {
      this.emitAction('CONFIRM');
    }
    if (this.isJustPressed(buttons, 1)) {
      this.emitAction('BACK');
    }
    if (this.isJustPressed(buttons, 8) || this.isJustPressed(buttons, 9)) {
      this.emitAction('START');
    }
    if (this.isJustPressed(buttons, 2) || this.isJustPressed(buttons, 3)) {
      this.emitAction('RESTART');
    }

    this.prevButtons = buttons;
  }

  private isJustPressed(currentButtons: boolean[], index: number): boolean {
    return Boolean(currentButtons[index]) && !Boolean(this.prevButtons[index]);
  }

  private extractDirection(pad: Gamepad): GamepadDirection | null {
    // D-Pad (Standard Gamepad mapping)
    if (pad.buttons[12]?.pressed) return 'UP';
    if (pad.buttons[13]?.pressed) return 'DOWN';
    if (pad.buttons[14]?.pressed) return 'LEFT';
    if (pad.buttons[15]?.pressed) return 'RIGHT';

    // Left stick (axes[0], axes[1]) or right stick (axes[2], axes[3])
    const ax0 = pad.axes[0] ?? 0;
    const ax1 = pad.axes[1] ?? 0;
    const ax2 = pad.axes[2] ?? 0;
    const ax3 = pad.axes[3] ?? 0;

    const x = Math.abs(ax0) >= Math.abs(ax2) ? ax0 : ax2;
    const y = Math.abs(ax1) >= Math.abs(ax3) ? ax1 : ax3;

    if (Math.abs(x) < STICK_DEADZONE && Math.abs(y) < STICK_DEADZONE) {
      return null;
    }

    if (Math.abs(x) > Math.abs(y)) {
      return x < 0 ? 'LEFT' : 'RIGHT';
    } else {
      return y < 0 ? 'UP' : 'DOWN';
    }
  }

  private emitDirection(direction: GamepadDirection): void {
    this.callbacks.onAnyInput?.({ direction });
    this.callbacks.onDirection?.(direction);
  }

  private emitAction(action: GamepadAction): void {
    this.callbacks.onAnyInput?.({ action });
    this.callbacks.onAction?.(action);
  }
}
