import { VirtualPointerEvent } from '../../l1_infrastructure/VirtualViewport';

export type ControlDirection = 'UP' | 'DOWN' | 'LEFT' | 'RIGHT';

export type ControlAction =
  | 'CONFIRM'
  | 'CANCEL'
  | 'PAUSE'
  | 'MENU'
  | 'RESTART'
  | 'FOCUS_NEXT'
  | 'FOCUS_PREV';

export type ControlInputSource =
  | 'keyboard'
  | 'gamepad'
  | 'pointer'
  | 'virtual-control';

export type ControlDirectionPhase = 'pressed' | 'repeat' | 'released';

export type PointerControlType = 'MOVE' | 'DOWN' | 'UP' | 'CLICK' | 'LEAVE';

export interface ControlEventBase {
  readonly source: ControlInputSource;
  readonly timestamp: number;
  readonly consumed: boolean;
  consume(): void;
}

export interface DirectionControlEvent extends ControlEventBase {
  readonly kind: 'DIRECTION';
  readonly direction: ControlDirection;
  readonly phase: ControlDirectionPhase;
  readonly originalEvent?: KeyboardEvent | Event;
}

export interface ActionControlEvent extends ControlEventBase {
  readonly kind: 'ACTION';
  readonly action: ControlAction;
  readonly originalEvent?: KeyboardEvent | Event;
}

export interface PointerControlEvent extends ControlEventBase {
  readonly kind: 'POINTER';
  readonly pointerType: PointerControlType;
  readonly vx: number;
  readonly vy: number;
  readonly originalEvent?: MouseEvent;
}

export interface GamepadStatusControlEvent extends ControlEventBase {
  readonly kind: 'GAMEPAD_STATUS';
  readonly connected: boolean;
  readonly controllerName?: string;
}

export interface RawKeyControlEvent extends ControlEventBase {
  readonly kind: 'RAW_KEY';
  readonly code: string;
  readonly key: string;
  readonly phase: 'down' | 'up';
  readonly repeat: boolean;
  readonly originalEvent: KeyboardEvent;
}

export type ControlEvent =
  | DirectionControlEvent
  | ActionControlEvent
  | PointerControlEvent
  | GamepadStatusControlEvent
  | RawKeyControlEvent;

function createBase(source: ControlInputSource): {
  readonly source: ControlInputSource;
  readonly timestamp: number;
  readonly consumed: boolean;
  consume(): void;
} {
  let isConsumed = false;
  return {
    source,
    timestamp: performance.now(),
    get consumed() {
      return isConsumed;
    },
    consume() {
      isConsumed = true;
    },
  };
}

export function createDirectionControlEvent(
  direction: ControlDirection,
  phase: ControlDirectionPhase = 'pressed',
  source: ControlInputSource = 'keyboard',
  originalEvent?: KeyboardEvent | Event
): DirectionControlEvent {
  const base = createBase(source);
  return {
    get source() {
      return base.source;
    },
    get timestamp() {
      return base.timestamp;
    },
    get consumed() {
      return base.consumed;
    },
    consume: () => base.consume(),
    kind: 'DIRECTION',
    direction,
    phase,
    originalEvent,
  };
}

export function createActionControlEvent(
  action: ControlAction,
  source: ControlInputSource = 'keyboard',
  originalEvent?: KeyboardEvent | Event
): ActionControlEvent {
  const base = createBase(source);
  return {
    get source() {
      return base.source;
    },
    get timestamp() {
      return base.timestamp;
    },
    get consumed() {
      return base.consumed;
    },
    consume: () => base.consume(),
    kind: 'ACTION',
    action,
    originalEvent,
  };
}

export function createPointerControlEvent(
  pointerType: PointerControlType,
  pointer: VirtualPointerEvent | { vx: number; vy: number; originalEvent?: MouseEvent }
): PointerControlEvent {
  const base = createBase('pointer');
  return {
    get source() {
      return base.source;
    },
    get timestamp() {
      return base.timestamp;
    },
    get consumed() {
      return base.consumed;
    },
    consume: () => base.consume(),
    kind: 'POINTER',
    pointerType,
    vx: pointer.vx,
    vy: pointer.vy,
    originalEvent: pointer.originalEvent,
  };
}

export function createGamepadStatusControlEvent(
  connected: boolean,
  controllerName?: string
): GamepadStatusControlEvent {
  const base = createBase('gamepad');
  return {
    get source() {
      return base.source;
    },
    get timestamp() {
      return base.timestamp;
    },
    get consumed() {
      return base.consumed;
    },
    consume: () => base.consume(),
    kind: 'GAMEPAD_STATUS',
    connected,
    controllerName,
  };
}

export function createRawKeyControlEvent(
  phase: 'down' | 'up',
  originalEvent: KeyboardEvent
): RawKeyControlEvent {
  const base = createBase('keyboard');
  return {
    get source() {
      return base.source;
    },
    get timestamp() {
      return base.timestamp;
    },
    get consumed() {
      return base.consumed;
    },
    consume: () => base.consume(),
    kind: 'RAW_KEY',
    code: originalEvent.code,
    key: originalEvent.key,
    phase,
    repeat: originalEvent.repeat,
    originalEvent,
  };
}
