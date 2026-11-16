import {
  GamepadAction,
  GamepadDirection,
  GamepadManager,
} from '../GamepadManager';
import { VirtualViewport } from '../VirtualViewport';
import {
  ControlAction,
  ControlDirection,
  ControlEvent,
  ControlInputSource,
  createActionControlEvent,
  createDirectionControlEvent,
  createGamepadStatusControlEvent,
  createPointerControlEvent,
  createRawKeyControlEvent,
} from './ControlEvents';

export interface InputKeyBindings {
  readonly directions: Readonly<Record<string, ControlDirection>>;
  readonly actions: Readonly<Record<string, ControlAction>>;
}

export const DEFAULT_INPUT_KEY_BINDINGS: InputKeyBindings = {
  directions: {
    ArrowUp: 'UP',
    KeyW: 'UP',
    ArrowDown: 'DOWN',
    KeyS: 'DOWN',
    ArrowLeft: 'LEFT',
    KeyA: 'LEFT',
    ArrowRight: 'RIGHT',
    KeyD: 'RIGHT',
  },
  actions: {
    Enter: 'CONFIRM',
    Space: 'CONFIRM',
    Escape: 'CANCEL',
    Backspace: 'CANCEL',
    KeyP: 'PAUSE',
    KeyR: 'RESTART',
    Tab: 'FOCUS_NEXT',
  },
};

export type ControlEventListener = (event: ControlEvent) => void;

export interface InputRouterConfig {
  viewport: VirtualViewport;
  onEvent: ControlEventListener;
  keyBindings?: InputKeyBindings;
}

const IGNORED_RAW_MODIFIER_KEYS = new Set([
  'ShiftLeft',
  'ShiftRight',
  'ControlLeft',
  'ControlRight',
  'AltLeft',
  'AltRight',
  'MetaLeft',
  'MetaRight',
  'CapsLock',
]);

/**
 * High-level input abstraction router in the engine layer.
 * Aggregates low-level Keyboard events, GamepadManager state, VirtualViewport pointer coordinates,
 * and synthetic on-screen control triggers into normalized `ControlEvent` instances
 * dispatched down the application node tree.
 */
export class InputRouter {
  private readonly viewport: VirtualViewport;
  private readonly onEvent: ControlEventListener;
  private readonly bindings: InputKeyBindings;
  private readonly gamepadManager: GamepadManager;
  private readonly heldKeys = new Set<string>();

  private unsubPointerMove: (() => void) | null = null;
  private unsubPointerClick: (() => void) | null = null;
  private unsubPointerLeave: (() => void) | null = null;
  private running = false;

  private readonly handleWindowKeyDown = (event: KeyboardEvent) => {
    if (!this.running || this.isExternalFormElement(event.target)) {
      return;
    }

    // 1. Emit raw key event first for nodes that explicitly listen to raw keys (e.g., readiness overlays or text inputs)
    if (!IGNORED_RAW_MODIFIER_KEYS.has(event.code)) {
      const rawEvent = createRawKeyControlEvent('down', event);
      this.onEvent(rawEvent);
      if (rawEvent.consumed) {
        event.preventDefault();
        return;
      }
    }

    const isRepeat = this.heldKeys.has(event.code) || event.repeat;
    this.heldKeys.add(event.code);

    // 2. Check directional mapping
    const mappedDir = this.bindings.directions[event.code];
    if (mappedDir) {
      const dirEvent = createDirectionControlEvent(
        mappedDir,
        isRepeat ? 'repeat' : 'pressed',
        'keyboard',
        event
      );
      this.onEvent(dirEvent);
      if (dirEvent.consumed) {
        event.preventDefault();
      }
      return;
    }

    // 3. Check semantic action mapping (only on initial press)
    if (!isRepeat) {
      let mappedAction = this.bindings.actions[event.code];
      if (event.code === 'Tab' && event.shiftKey) {
        mappedAction = 'FOCUS_PREV';
      }
      if (mappedAction) {
        const actionEvent = createActionControlEvent(
          mappedAction,
          'keyboard',
          event
        );
        this.onEvent(actionEvent);
        if (actionEvent.consumed) {
          event.preventDefault();
        }
      }
    }
  };

  private readonly handleWindowKeyUp = (event: KeyboardEvent) => {
    this.heldKeys.delete(event.code);
    if (!this.running || this.isExternalFormElement(event.target)) {
      return;
    }

    const mappedDir = this.bindings.directions[event.code];
    if (mappedDir) {
      const dirEvent = createDirectionControlEvent(
        mappedDir,
        'released',
        'keyboard',
        event
      );
      this.onEvent(dirEvent);
    }
  };

  private readonly handleWindowBlur = () => {
    this.heldKeys.clear();
  };

  constructor(config: InputRouterConfig) {
    this.viewport = config.viewport;
    this.onEvent = config.onEvent;
    this.bindings = config.keyBindings ?? DEFAULT_INPUT_KEY_BINDINGS;

    this.gamepadManager = new GamepadManager({
      onConnectionChange: (connected, controllerName) => {
        if (!this.running) return;
        this.onEvent(
          createGamepadStatusControlEvent(connected, controllerName)
        );
      },
      onDirection: (dir: GamepadDirection) => {
        if (!this.running) return;
        this.onEvent(createDirectionControlEvent(dir, 'pressed', 'gamepad'));
      },
      onAction: (action: GamepadAction) => {
        if (!this.running) return;
        const mapped = this.mapGamepadAction(action);
        this.onEvent(createActionControlEvent(mapped, 'gamepad'));
      },
    });
  }

  public start(): void {
    if (this.running) return;
    this.running = true;

    window.addEventListener('keydown', this.handleWindowKeyDown);
    window.addEventListener('keyup', this.handleWindowKeyUp);
    window.addEventListener('blur', this.handleWindowBlur);

    this.unsubPointerMove = this.viewport.onPointerMove((ptr) => {
      if (!this.running) return;
      this.onEvent(createPointerControlEvent('MOVE', ptr));
    });

    this.unsubPointerClick = this.viewport.onPointerClick((ptr) => {
      if (!this.running) return;
      this.onEvent(createPointerControlEvent('CLICK', ptr));
    });

    this.unsubPointerLeave = this.viewport.onPointerLeave(() => {
      if (!this.running) return;
      this.onEvent(createPointerControlEvent('LEAVE', { vx: -1, vy: -1 }));
    });

    this.gamepadManager.start();
  }

  public stop(): void {
    if (!this.running) return;
    this.running = false;
    this.heldKeys.clear();

    window.removeEventListener('keydown', this.handleWindowKeyDown);
    window.removeEventListener('keyup', this.handleWindowKeyUp);
    window.removeEventListener('blur', this.handleWindowBlur);

    this.unsubPointerMove?.();
    this.unsubPointerClick?.();
    this.unsubPointerLeave?.();
    this.unsubPointerMove = null;
    this.unsubPointerClick = null;
    this.unsubPointerLeave = null;

    this.gamepadManager.stop();
  }

  public dispose(): void {
    this.stop();
  }

  /**
   * Emits a normalized directional control event (e.g. from an on-screen virtual D-Pad control).
   */
  public emitDirection(
    direction: ControlDirection,
    source: ControlInputSource = 'virtual-control'
  ): void {
    if (!this.running) return;
    this.onEvent(createDirectionControlEvent(direction, 'pressed', source));
  }

  /**
   * Emits a normalized semantic action event (e.g. from an on-screen HUD button).
   */
  public emitAction(
    action: ControlAction,
    source: ControlInputSource = 'virtual-control'
  ): void {
    if (!this.running) return;
    this.onEvent(createActionControlEvent(action, source));
  }

  public isGamepadConnected(): boolean {
    return this.gamepadManager.isConnected();
  }

  public getGamepadName(): string | undefined {
    return this.gamepadManager.getControllerName();
  }

  public vibrate(
    durationMs = 80,
    weakMagnitude = 0.3,
    strongMagnitude = 0.15
  ): void {
    this.gamepadManager.vibrate(durationMs, weakMagnitude, strongMagnitude);
  }

  private mapGamepadAction(action: GamepadAction): ControlAction {
    switch (action) {
      case 'CONFIRM':
        return 'CONFIRM';
      case 'BACK':
        return 'CANCEL';
      case 'START':
        return 'PAUSE';
      case 'RESTART':
        return 'RESTART';
    }
  }

  private isExternalFormElement(target: EventTarget | null): boolean {
    const el = target as HTMLElement | null;
    if (!el || !el.tagName) return false;
    const tag = el.tagName.toUpperCase();
    return (
      tag === 'INPUT' ||
      tag === 'SELECT' ||
      tag === 'TEXTAREA' ||
      el.isContentEditable
    );
  }
}
