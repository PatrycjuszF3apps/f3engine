import type { Node } from './Node';

/**
 * Execution phases for node and tree lifecycle hooks during a frame cycle.
 */
export enum HookPhase {
  BEFORE_UPDATE = 'BEFORE_UPDATE',
  AFTER_UPDATE = 'AFTER_UPDATE',
  BEFORE_RENDER = 'BEFORE_RENDER',
  AFTER_RENDER = 'AFTER_RENDER',
}

/**
 * Callback signature for a lifecycle hook attached to a specific Node or to the NodeTreeProcessor.
 * Returning `true` automatically unregisters the hook after execution (one-shot hook).
 */
export type NodeHookFn<
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  TNode extends Node<any, any> = Node<any, any>,
> = (node: TNode, dt: number) => boolean | void;

export interface NodeResetOptions {
  /** Whether to cascade `resetState` recursively to all child nodes (defaults to `true`). */
  recursive?: boolean;
}
